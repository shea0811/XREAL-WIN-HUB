import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Gamepad2, Mic, PictureInPicture2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { platform } from '../services/platform';
import type { DiscordStatus, EmbeddedViewBounds } from '../types';

const INITIAL_STATUS: DiscordStatus = { supported: false, state: 'idle', canGoBack: false, canGoForward: false, detached: false };

function elementBounds(element: HTMLElement): EmbeddedViewBounds {
  const rect = element.getBoundingClientRect();
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(520, Math.round(rect.width)), height: Math.max(420, Math.round(rect.height)) };
}

export function Discord({ onToast, obscured = false }: { onToast(message: string, detail?: string): void; obscured?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<DiscordStatus>(INITIAL_STATUS);
  const [floatingOnTop, setFloatingOnTop] = useState(false);

  const positionView = useCallback(() => {
    if (!stageRef.current || obscured || status.detached || !status.supported) return;
    void platform.setDiscordEmbedded(true, elementBounds(stageRef.current)).then(setStatus);
  }, [obscured, status.detached, status.supported]);

  useEffect(() => {
    let active = true;
    void platform.getDiscordStatus().then((value) => { if (active) setStatus(value); });
    const unsubscribe = platform.onDiscordStatus((value) => { if (active) setStatus(value); });
    return () => { active = false; unsubscribe(); void platform.setDiscordEmbedded(false); };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !status.supported || status.detached) return;
    if (obscured) { void platform.setDiscordEmbedded(false); return; }
    positionView();
    const observer = new ResizeObserver(positionView);
    observer.observe(stage);
    window.addEventListener('resize', positionView);
    window.addEventListener('scroll', positionView, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', positionView); window.removeEventListener('scroll', positionView, true); };
  }, [obscured, positionView, status.detached, status.supported]);

  async function detach() {
    const next = await platform.detachDiscord(floatingOnTop);
    setStatus(next);
    if (next.detached) onToast('Discord detached', 'Chat and calls continue in the isolated floating window.');
  }

  const stateLabel = status.detached ? 'Floating window' : status.state === 'ready' ? 'Secure session ready' : status.state === 'failed' ? 'Could not load' : status.state === 'loading' ? 'Connecting' : 'Session idle';

  return <div className="module-page discord-page">
    <SectionHeading eyebrow="Communities and voice" title="Discord" description="Use Discord Web inside an isolated Hub workspace, with microphone and camera access only after you approve it." actions={<StatusPill tone={status.state === 'failed' ? 'warning' : 'positive'}><ShieldCheck size={12} /> {stateLabel}</StatusPill>} />
    <section className="whatsapp-shell discord-shell card-surface">
      <div className="whatsapp-toolbar" aria-label="Discord controls">
        <div className="whatsapp-toolbar__nav"><Button variant="ghost" onClick={() => void platform.navigateDiscord('back')} disabled={!status.canGoBack || status.detached} aria-label="Discord back"><ArrowLeft size={16} /></Button><Button variant="ghost" onClick={() => void platform.navigateDiscord('forward')} disabled={!status.canGoForward || status.detached} aria-label="Discord forward"><ArrowRight size={16} /></Button><Button variant="ghost" onClick={() => void platform.reloadDiscord()} disabled={!status.supported || status.detached} aria-label="Reload Discord"><RefreshCw size={16} /></Button></div>
        <div className="whatsapp-toolbar__actions"><label className="whatsapp-on-top"><input type="checkbox" checked={floatingOnTop} onChange={(event) => { setFloatingOnTop(event.target.checked); if (status.detached) void platform.setDiscordAlwaysOnTop(event.target.checked); }} /> Float on top</label><Button variant="primary" onClick={() => void detach()} disabled={!status.supported || status.detached}><PictureInPicture2 size={16} /> Detach</Button></div>
      </div>
      <div className="whatsapp-stage discord-stage" ref={stageRef} aria-label="Discord workspace">
        {!status.supported ? <div className="whatsapp-empty"><Gamepad2 size={42} /><h2>Discord needs the installed Windows app</h2><p>The browser preview cannot host the isolated Discord surface.</p><Button variant="secondary" onClick={() => void platform.openExternal('https://discord.com/app')}><ExternalLink size={16} /> Open Discord Web</Button></div>
          : status.detached ? <div className="whatsapp-empty"><PictureInPicture2 size={42} /><h2>Discord is in its floating window</h2><p>Close that window to restore it here.</p></div>
            : status.state === 'failed' ? <div className="whatsapp-empty"><Gamepad2 size={42} /><h2>Discord did not load</h2><p>{status.message ?? 'Check your connection and reload Discord.'}</p><Button variant="secondary" onClick={() => void platform.reloadDiscord()}><RefreshCw size={16} /> Try again</Button></div>
              : <div className="whatsapp-loading" aria-hidden><Gamepad2 size={34} /><span>{status.state === 'ready' ? 'Discord Web' : 'Starting secure session…'}</span></div>}
      </div>
    </section>
    <div className="privacy-note discord-voice-note"><Mic size={19} /><p><strong>Voice devices stay under Discord control.</strong> Choose and test the microphone, speaker, noise suppression, input sensitivity and camera in Discord’s User Settings → Voice &amp; Video.</p></div>
  </div>;
}
