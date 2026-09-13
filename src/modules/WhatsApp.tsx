import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  LockKeyhole,
  MessageCircle,
  PictureInPicture2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { platform } from '../services/platform';
import type { EmbeddedViewBounds, WhatsAppStatus } from '../types';

const INITIAL_STATUS: WhatsAppStatus = {
  supported: false,
  state: 'idle',
  canGoBack: false,
  canGoForward: false,
  detached: false,
};

function elementBounds(element: HTMLElement): EmbeddedViewBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(320, Math.round(rect.width)),
    height: Math.max(360, Math.round(rect.height)),
  };
}

export function WhatsApp({
  onToast,
  obscured = false,
}: {
  onToast(message: string, detail?: string): void;
  obscured?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<WhatsAppStatus>(INITIAL_STATUS);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [floatingOnTop, setFloatingOnTop] = useState(false);

  const positionView = useCallback(() => {
    if (!stageRef.current || privacyMode || obscured || status.detached || !status.supported) return;
    void platform.setWhatsAppEmbedded(true, elementBounds(stageRef.current)).then(setStatus);
  }, [obscured, privacyMode, status.detached, status.supported]);

  useEffect(() => {
    let active = true;
    void platform.getWhatsAppStatus().then((value) => {
      if (active) setStatus(value);
    });
    const unsubscribe = platform.onWhatsAppStatus((value) => {
      if (active) setStatus(value);
    });
    return () => {
      active = false;
      unsubscribe();
      void platform.setWhatsAppEmbedded(false);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !status.supported || status.detached) return;
    if (privacyMode || obscured) {
      void platform.setWhatsAppEmbedded(false);
      return;
    }
    positionView();
    const observer = new ResizeObserver(positionView);
    observer.observe(stage);
    window.addEventListener('resize', positionView);
    window.addEventListener('scroll', positionView, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionView);
      window.removeEventListener('scroll', positionView, true);
    };
  }, [positionView, privacyMode, obscured, status.detached, status.supported]);

  async function detach() {
    const next = await platform.detachWhatsApp(floatingOnTop);
    setStatus(next);
    if (next.detached) onToast('WhatsApp detached', 'The secure floating window uses the same linked session.');
  }

  async function openInBrowser() {
    const opened = await platform.openExternal('https://web.whatsapp.com/');
    if (!opened) onToast('Could not open WhatsApp Web');
  }

  async function changeFloatingOnTop(enabled: boolean) {
    setFloatingOnTop(enabled);
    if (status.detached) await platform.setWhatsAppAlwaysOnTop(enabled);
  }

  const stateLabel = status.detached
    ? 'Floating window'
    : status.state === 'ready'
      ? 'Secure session ready'
      : status.state === 'failed'
        ? 'Could not load'
        : status.state === 'loading'
          ? 'Connecting'
          : 'Session idle';

  return (
    <div className="module-page whatsapp-page">
      <SectionHeading
        eyebrow="Linked device"
        title="WhatsApp"
        description="Use the real WhatsApp Web experience without leaving XREAL WIN HUB. Your linked session stays isolated from Hub data and device controls."
        actions={<StatusPill tone={status.state === 'failed' ? 'warning' : 'positive'}><ShieldCheck size={12} /> {stateLabel}</StatusPill>}
      />

      <section className="whatsapp-shell card-surface">
        <div className="whatsapp-toolbar" aria-label="WhatsApp controls">
          <div className="whatsapp-toolbar__nav">
            <Button variant="ghost" onClick={() => void platform.navigateWhatsApp('back')} disabled={!status.canGoBack || status.detached} aria-label="WhatsApp back"><ArrowLeft size={16} /></Button>
            <Button variant="ghost" onClick={() => void platform.navigateWhatsApp('forward')} disabled={!status.canGoForward || status.detached} aria-label="WhatsApp forward"><ArrowRight size={16} /></Button>
            <Button variant="ghost" onClick={() => void platform.reloadWhatsApp()} disabled={!status.supported || status.detached} aria-label="Reload WhatsApp"><RefreshCw size={16} /></Button>
          </div>
          <div className="whatsapp-toolbar__actions">
            <label className="whatsapp-on-top">
              <input type="checkbox" checked={floatingOnTop} onChange={(event) => void changeFloatingOnTop(event.target.checked)} />
              Float on top
            </label>
            <Button variant="secondary" onClick={() => setPrivacyMode((value) => !value)} disabled={!status.supported || status.detached}>
              <LockKeyhole size={16} /> {privacyMode ? 'Show chats' : 'Privacy hide'}
            </Button>
            <Button variant="primary" onClick={() => void detach()} disabled={!status.supported || status.detached}>
              <PictureInPicture2 size={16} /> Detach
            </Button>
          </div>
        </div>

        <div className="whatsapp-stage" ref={stageRef} aria-label="WhatsApp Web workspace">
          {!status.supported ? (
            <div className="whatsapp-empty">
              <MessageCircle size={42} />
              <h2>WhatsApp Web needs the installed Windows app</h2>
              <p>The normal browser preview cannot create the isolated browser surface used for your linked session.</p>
              <Button variant="secondary" onClick={() => void openInBrowser()}><ExternalLink size={16} /> Open temporary browser session</Button>
            </div>
          ) : status.detached ? (
            <div className="whatsapp-empty"><PictureInPicture2 size={42} /><h2>WhatsApp is in its floating window</h2><p>Close that window to return the secure session to this page.</p></div>
          ) : privacyMode ? (
            <div className="whatsapp-empty whatsapp-empty--private"><LockKeyhole size={42} /><h2>Chats hidden</h2><p>The browser surface is removed from view without signing you out.</p></div>
          ) : status.state === 'failed' ? (
            <div className="whatsapp-empty"><MessageCircle size={42} /><h2>WhatsApp Web did not load</h2><p>{status.message ?? 'Check your connection, then reload the secure session.'}</p><Button variant="secondary" onClick={() => void platform.reloadWhatsApp()}><RefreshCw size={16} /> Try again</Button></div>
          ) : (
            <div className="whatsapp-loading" aria-hidden><MessageCircle size={34} /><span>{status.state === 'ready' ? 'WhatsApp Web' : 'Starting secure session…'}</span></div>
          )}
        </div>
      </section>

      <div className="privacy-note whatsapp-privacy-note">
        <ShieldCheck size={19} />
        <p><strong>Isolated by design.</strong> WhatsApp has no Node.js, preload, Hub IPC, local-file or unrestricted navigation access. Messaging remains under your control.</p>
      </div>
    </div>
  );
}
