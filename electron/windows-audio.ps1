[CmdletBinding()]
param(
  [ValidateSet('Get', 'SetMaster', 'SetSession')]
  [string]$Action = 'Get',
  [ValidateRange(0, 100)]
  [int]$Volume = 50,
  [string]$SessionKey
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class HubAudio
{
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    private class MMDeviceEnumerator { }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    private interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, uint stateMask, out IntPtr devices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        int GetDevice(string id, out IMMDevice device);
        int RegisterEndpointNotificationCallback(IntPtr client);
        int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    private interface IMMDevice
    {
        int Activate(ref Guid iid, uint context, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object value);
        int OpenPropertyStore(uint access, out IntPtr properties);
        int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetState(out uint state);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    private interface IAudioEndpointVolume
    {
        int RegisterControlChangeNotify(IntPtr notify);
        int UnregisterControlChangeNotify(IntPtr notify);
        int GetChannelCount(out uint count);
        int SetMasterVolumeLevel(float levelDb, Guid context);
        int SetMasterVolumeLevelScalar(float level, Guid context);
        int GetMasterVolumeLevel(out float levelDb);
        int GetMasterVolumeLevelScalar(out float level);
        int SetChannelVolumeLevel(uint channel, float levelDb, Guid context);
        int SetChannelVolumeLevelScalar(uint channel, float level, Guid context);
        int GetChannelVolumeLevel(uint channel, out float levelDb);
        int GetChannelVolumeLevelScalar(uint channel, out float level);
        int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid context);
        int GetMute(out bool mute);
        int GetVolumeStepInfo(out uint step, out uint stepCount);
        int VolumeStepUp(Guid context);
        int VolumeStepDown(Guid context);
        int QueryHardwareSupport(out uint mask);
        int GetVolumeRange(out float minDb, out float maxDb, out float incrementDb);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
    private interface IAudioSessionManager2
    {
        int GetAudioSessionControl(ref Guid sessionGuid, uint flags, out IntPtr control);
        int GetSimpleAudioVolume(ref Guid sessionGuid, uint flags, out IntPtr volume);
        int GetSessionEnumerator(out IAudioSessionEnumerator enumerator);
        int RegisterSessionNotification(IntPtr notification);
        int UnregisterSessionNotification(IntPtr notification);
        int RegisterDuckNotification(string sessionId, IntPtr notification);
        int UnregisterDuckNotification(IntPtr notification);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
    private interface IAudioSessionEnumerator
    {
        int GetCount(out int count);
        int GetSession(int index, out IAudioSessionControl2 control);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D")]
    private interface IAudioSessionControl2
    {
        int GetState(out int state);
        int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        int SetDisplayName(string name, Guid context);
        int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        int SetIconPath(string path, Guid context);
        int GetGroupingParam(out Guid grouping);
        int SetGroupingParam(Guid grouping, Guid context);
        int RegisterAudioSessionNotification(IntPtr client);
        int UnregisterAudioSessionNotification(IntPtr client);
        int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        int GetProcessId(out uint processId);
        int IsSystemSoundsSession();
        int SetDuckingPreference(bool optOut);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
    private interface ISimpleAudioVolume
    {
        int SetMasterVolume(float level, Guid context);
        int GetMasterVolume(out float level);
        int SetMute(bool mute, Guid context);
        int GetMute(out bool mute);
    }

    public class SessionInfo
    {
        public string key;
        public string name;
        public int volume;
        public bool muted;
        public uint processId;
    }

    private static IMMDevice DefaultOutput()
    {
        var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice device;
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
        return device;
    }

    private static T Activate<T>(IMMDevice device)
    {
        var iid = typeof(T).GUID;
        object value;
        Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out value));
        return (T)value;
    }

    public static int GetMaster()
    {
        float level;
        Marshal.ThrowExceptionForHR(Activate<IAudioEndpointVolume>(DefaultOutput()).GetMasterVolumeLevelScalar(out level));
        return Math.Max(0, Math.Min(100, (int)Math.Round(level * 100)));
    }

    public static void SetMaster(int volume)
    {
        var context = Guid.Empty;
        Marshal.ThrowExceptionForHR(Activate<IAudioEndpointVolume>(DefaultOutput()).SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, volume)) / 100f, context));
    }

    private static string ProcessName(uint processId)
    {
        if (processId == 0) return "System sounds";
        try { return Process.GetProcessById((int)processId).ProcessName; }
        catch { return "Application"; }
    }

    private static string Key(string value)
    {
        return (value ?? "application").Trim().ToLowerInvariant();
    }

    public static List<SessionInfo> GetSessions()
    {
        var manager = Activate<IAudioSessionManager2>(DefaultOutput());
        IAudioSessionEnumerator sessions;
        Marshal.ThrowExceptionForHR(manager.GetSessionEnumerator(out sessions));
        int count;
        Marshal.ThrowExceptionForHR(sessions.GetCount(out count));
        var result = new List<SessionInfo>();
        for (var index = 0; index < count; index++)
        {
            IAudioSessionControl2 control;
            if (sessions.GetSession(index, out control) != 0 || control == null) continue;
            uint processId;
            control.GetProcessId(out processId);
            var name = ProcessName(processId);
            var volume = (ISimpleAudioVolume)control;
            float level;
            bool muted;
            if (volume.GetMasterVolume(out level) != 0 || volume.GetMute(out muted) != 0) continue;
            result.Add(new SessionInfo {
                key = Key(name), name = name, processId = processId,
                volume = Math.Max(0, Math.Min(100, (int)Math.Round(level * 100))), muted = muted
            });
        }
        return result;
    }

    public static int SetSession(string sessionKey, int requestedVolume)
    {
        var manager = Activate<IAudioSessionManager2>(DefaultOutput());
        IAudioSessionEnumerator sessions;
        Marshal.ThrowExceptionForHR(manager.GetSessionEnumerator(out sessions));
        int count;
        sessions.GetCount(out count);
        var matches = 0;
        for (var index = 0; index < count; index++)
        {
            IAudioSessionControl2 control;
            if (sessions.GetSession(index, out control) != 0 || control == null) continue;
            uint processId;
            control.GetProcessId(out processId);
            if (Key(ProcessName(processId)) != Key(sessionKey)) continue;
            var context = Guid.Empty;
            var volume = (ISimpleAudioVolume)control;
            if (volume.SetMasterVolume(Math.Max(0, Math.Min(100, requestedVolume)) / 100f, context) == 0) matches++;
        }
        return matches;
    }
}
'@

if ($Action -eq 'SetMaster') {
  [HubAudio]::SetMaster($Volume)
}
elseif ($Action -eq 'SetSession') {
  if ([string]::IsNullOrWhiteSpace($SessionKey) -or $SessionKey.Length -gt 120) {
    throw 'A valid audio session key is required.'
  }
  $changed = [HubAudio]::SetSession($SessionKey, $Volume)
  if ($changed -lt 1) { throw 'That application does not currently have an active Windows audio session.' }
}

$sessions = @([HubAudio]::GetSessions() | Group-Object key | ForEach-Object { $_.Group | Select-Object -First 1 })
[PSCustomObject]@{
  supported = $true
  masterVolume = [HubAudio]::GetMaster()
  sessions = $sessions
} | ConvertTo-Json -Depth 5 -Compress
