[CmdletBinding()]
param(
  [ValidateSet('Get', 'Apply', 'Watch')]
  [string]$Action = 'Get',
  [string]$PayloadPath,
  [string]$ConfirmToken,
  [ValidateRange(10, 60)]
  [int]$Seconds = 20
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class Win32Display
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DISPLAY_DEVICE
    {
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceString;
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceKey;
    }

    [StructLayout(LayoutKind.Explicit, CharSet = CharSet.Unicode, Size = 220)]
    public struct DEVMODE
    {
        [FieldOffset(0)]
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmDeviceName;
        [FieldOffset(64)]
        public ushort dmSpecVersion;
        [FieldOffset(66)]
        public ushort dmDriverVersion;
        [FieldOffset(68)]
        public ushort dmSize;
        [FieldOffset(70)]
        public ushort dmDriverExtra;
        [FieldOffset(72)]
        public uint dmFields;
        [FieldOffset(76)]
        public int dmPositionX;
        [FieldOffset(80)]
        public int dmPositionY;
        [FieldOffset(84)]
        public uint dmDisplayOrientation;
        [FieldOffset(88)]
        public uint dmDisplayFixedOutput;
        [FieldOffset(92)]
        public short dmColor;
        [FieldOffset(94)]
        public short dmDuplex;
        [FieldOffset(96)]
        public short dmYResolution;
        [FieldOffset(98)]
        public short dmTTOption;
        [FieldOffset(100)]
        public short dmCollate;
        [FieldOffset(102)]
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string dmFormName;
        [FieldOffset(166)]
        public ushort dmLogPixels;
        [FieldOffset(168)]
        public uint dmBitsPerPel;
        [FieldOffset(172)]
        public uint dmPelsWidth;
        [FieldOffset(176)]
        public uint dmPelsHeight;
        [FieldOffset(180)]
        public uint dmDisplayFlags;
        [FieldOffset(184)]
        public uint dmDisplayFrequency;
        [FieldOffset(188)]
        public uint dmICMMethod;
        [FieldOffset(192)]
        public uint dmICMIntent;
        [FieldOffset(196)]
        public uint dmMediaType;
        [FieldOffset(200)]
        public uint dmDitherType;
        [FieldOffset(204)]
        public uint dmReserved1;
        [FieldOffset(208)]
        public uint dmReserved2;
        [FieldOffset(212)]
        public uint dmPanningWidth;
        [FieldOffset(216)]
        public uint dmPanningHeight;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplayDevices(
        string lpDevice,
        uint iDevNum,
        ref DISPLAY_DEVICE lpDisplayDevice,
        uint dwFlags
    );

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplaySettings(
        string lpszDeviceName,
        int iModeNum,
        ref DEVMODE lpDevMode
    );

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "ChangeDisplaySettingsExW")]
    public static extern int ChangeDisplaySettingsEx(
        string lpszDeviceName,
        ref DEVMODE lpDevMode,
        IntPtr hwnd,
        uint dwflags,
        IntPtr lParam
    );

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "ChangeDisplaySettingsExW")]
    public static extern int ApplyDisplaySettings(
        string lpszDeviceName,
        IntPtr lpDevMode,
        IntPtr hwnd,
        uint dwflags,
        IntPtr lParam
    );
}
'@

$DisplayDeviceAttached = 0x00000001
$DisplayDevicePrimary = 0x00000004
$EnumCurrentSettings = -1
$DmPosition = 0x00000020
$CdsUpdateRegistry = 0x00000001
$CdsTest = 0x00000002
$CdsSetPrimary = 0x00000010
$CdsNoReset = 0x10000000
$DispChangeSuccessful = 0

function New-DisplayDevice {
  $device = New-Object Win32Display+DISPLAY_DEVICE
  $device.cb = [Runtime.InteropServices.Marshal]::SizeOf($device)
  return $device
}

function New-DeviceMode {
  $mode = New-Object Win32Display+DEVMODE
  $mode.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($mode)
  return $mode
}

function Get-DisplayLayout {
  $result = @()
  for ($index = 0; $index -lt 32; $index++) {
    $adapter = New-DisplayDevice
    if (-not [Win32Display]::EnumDisplayDevices($null, $index, [ref]$adapter, 0)) {
      break
    }
    if (($adapter.StateFlags -band $DisplayDeviceAttached) -eq 0) {
      continue
    }

    $mode = New-DeviceMode
    if (-not [Win32Display]::EnumDisplaySettings($adapter.DeviceName, $EnumCurrentSettings, [ref]$mode)) {
      continue
    }

    $monitor = New-DisplayDevice
    $friendlyName = $adapter.DeviceString
    if ([Win32Display]::EnumDisplayDevices($adapter.DeviceName, 0, [ref]$monitor, 1)) {
      if (-not [string]::IsNullOrWhiteSpace($monitor.DeviceString) -and $monitor.DeviceString -ne 'Generic PnP Monitor') {
        $friendlyName = $monitor.DeviceString
      }
    }
    if ([string]::IsNullOrWhiteSpace($friendlyName)) {
      $friendlyName = $adapter.DeviceName
    }

    $rotation = switch ($mode.dmDisplayOrientation) {
      1 { 90 }
      2 { 180 }
      3 { 270 }
      default { 0 }
    }

    $result += [PSCustomObject]@{
      id = $adapter.DeviceName
      deviceName = $adapter.DeviceName
      label = $friendlyName
      primary = (($adapter.StateFlags -band $DisplayDevicePrimary) -ne 0)
      internal = $false
      xreal = ($friendlyName -match '(?i)xreal|nreal|air 2|one pro')
      x = [int]$mode.dmPositionX
      y = [int]$mode.dmPositionY
      width = [int]$mode.dmPelsWidth
      height = [int]$mode.dmPelsHeight
      rotation = [int]$rotation
      scaleFactor = 1
    }
  }
  return @($result)
}

function Assert-Layout {
  param([object[]]$Items)

  if ($null -eq $Items -or $Items.Count -lt 1 -or $Items.Count -gt 16) {
    throw 'The display layout must contain between 1 and 16 active displays.'
  }
  if (@($Items | Where-Object { $_.primary -eq $true }).Count -ne 1) {
    throw 'Exactly one display must be marked as primary.'
  }

  $available = @{}
  foreach ($display in (Get-DisplayLayout)) {
    $available[$display.deviceName] = $true
  }
  foreach ($item in $Items) {
    if (-not $available.ContainsKey([string]$item.deviceName)) {
      throw "Display is no longer connected: $($item.deviceName)"
    }
    $x = [int]$item.x
    $y = [int]$item.y
    if ([Math]::Abs($x) -gt 32000 -or [Math]::Abs($y) -gt 32000) {
      throw 'A display position is outside the supported desktop range.'
    }
    if ($item.primary -eq $true -and ($x -ne 0 -or $y -ne 0)) {
      throw 'The primary display must be positioned at 0,0.'
    }
  }
}

function Set-DisplayLayout {
  param([object[]]$Items)

  Assert-Layout -Items $Items

  foreach ($item in $Items) {
    $mode = New-DeviceMode
    if (-not [Win32Display]::EnumDisplaySettings([string]$item.deviceName, $EnumCurrentSettings, [ref]$mode)) {
      throw "Unable to read the current mode for $($item.deviceName)."
    }
    $mode.dmFields = $mode.dmFields -bor $DmPosition
    $mode.dmPositionX = [int]$item.x
    $mode.dmPositionY = [int]$item.y
    $testFlags = [uint32]$CdsTest
    if ($item.primary -eq $true) {
      $testFlags = $testFlags -bor $CdsSetPrimary
    }
    $testResult = [Win32Display]::ChangeDisplaySettingsEx(
      [string]$item.deviceName,
      [ref]$mode,
      [IntPtr]::Zero,
      $testFlags,
      [IntPtr]::Zero
    )
    if ($testResult -ne $DispChangeSuccessful) {
      throw "Windows rejected the proposed position for $($item.deviceName) (code $testResult)."
    }
  }

  foreach ($item in $Items) {
    $mode = New-DeviceMode
    if (-not [Win32Display]::EnumDisplaySettings([string]$item.deviceName, $EnumCurrentSettings, [ref]$mode)) {
      throw "Unable to prepare $($item.deviceName)."
    }
    $mode.dmFields = $mode.dmFields -bor $DmPosition
    $mode.dmPositionX = [int]$item.x
    $mode.dmPositionY = [int]$item.y
    $flags = [uint32]($CdsUpdateRegistry -bor $CdsNoReset)
    if ($item.primary -eq $true) {
      $flags = $flags -bor $CdsSetPrimary
    }
    $stageResult = [Win32Display]::ChangeDisplaySettingsEx(
      [string]$item.deviceName,
      [ref]$mode,
      [IntPtr]::Zero,
      $flags,
      [IntPtr]::Zero
    )
    if ($stageResult -ne $DispChangeSuccessful) {
      throw "Windows could not stage $($item.deviceName) (code $stageResult)."
    }
  }

  $applyResult = [Win32Display]::ApplyDisplaySettings(
    $null,
    [IntPtr]::Zero,
    [IntPtr]::Zero,
    0,
    [IntPtr]::Zero
  )
  if ($applyResult -ne $DispChangeSuccessful) {
    throw "Windows could not apply the display layout (code $applyResult)."
  }
}

if ($Action -eq 'Watch') {
  if ([string]::IsNullOrWhiteSpace($PayloadPath) -or [string]::IsNullOrWhiteSpace($ConfirmToken)) {
    throw 'Rollback watch requires a payload and confirmation token.'
  }
  Start-Sleep -Seconds $Seconds
  if (-not (Test-Path -LiteralPath $ConfirmToken)) {
    $rollback = @(Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json)
    Set-DisplayLayout -Items $rollback
  }
  exit 0
}

if ($Action -eq 'Apply') {
  if ([string]::IsNullOrWhiteSpace($PayloadPath)) {
    throw 'Apply requires a payload path.'
  }
  $layout = @(Get-Content -LiteralPath $PayloadPath -Raw | ConvertFrom-Json)
  Set-DisplayLayout -Items $layout
  [PSCustomObject]@{ success = $true; displays = @(Get-DisplayLayout) } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

[PSCustomObject]@{ success = $true; displays = @(Get-DisplayLayout) } | ConvertTo-Json -Depth 6 -Compress
