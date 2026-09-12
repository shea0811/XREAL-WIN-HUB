import { type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Bot,
  Braces,
  GraduationCap,
  LifeBuoy,
  LockKeyhole,
  SearchCode,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button, SectionHeading, StatusPill } from '../components/ui';
import { platform } from '../services/platform';
import { useHub } from '../state/HubContext';

const AGENTS = [
  {
    id: 'study',
    name: 'Study partner',
    description: 'Break down cybersecurity topics, test understanding, and turn notes into revision prompts.',
    icon: GraduationCap,
    accent: '#5ee5d5',
    prompt: 'Help me study my MSc Cybersecurity material. Start by asking what module or topic I am working on.',
  },
  {
    id: 'builder',
    name: 'App builder',
    description: 'Plan features, review implementation ideas, and continue work on XREAL WIN HUB.',
    icon: Braces,
    accent: '#9d8cff',
    prompt: 'Help me continue building XREAL WIN HUB. Review the current goal and propose the next concrete implementation task.',
  },
  {
    id: 'research',
    name: 'Research desk',
    description: 'Turn a broad question into a source-backed research plan and concise findings.',
    icon: SearchCode,
    accent: '#65a9ff',
    prompt: 'Help me research a topic rigorously. Ask for the topic and what decision the research should support.',
  },
  {
    id: 'support',
    name: 'Service desk coach',
    description: 'Structure troubleshooting, user questions, ticket notes, and escalation summaries.',
    icon: LifeBuoy,
    accent: '#ffb86b',
    prompt: 'Act as my L1 service desk coach. Ask me for the symptoms, affected user scope, and checks already completed.',
  },
];

export function Agents({ onToast }: { onToast(message: string, detail?: string): void }) {
  const { recordActivity } = useHub();

  async function launchAgent(agent: (typeof AGENTS)[number]) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(agent.prompt);
      copied = true;
    } catch {
      // Clipboard access can be unavailable in the browser preview; opening still works.
    }
    const opened = await platform.openExternal('https://chatgpt.com');
    if (opened) {
      recordActivity({
        kind: 'workspace',
        title: `${agent.name} opened`,
        detail: copied
          ? 'Starter prompt copied to the clipboard.'
          : 'ChatGPT opened; clipboard access was unavailable.',
      });
      onToast(
        `${agent.name} is ready`,
        copied
          ? 'The starter prompt has been copied for ChatGPT.'
          : 'Copy the starter prompt shown on the card into ChatGPT.',
      );
    } else {
      onToast('Could not open ChatGPT', 'Your browser may have blocked the new window.');
    }
  }

  return (
    <div className="module-page">
      <SectionHeading
        eyebrow="AI launchpad"
        title="Agent desk"
        description="Purpose-built starting points for studying, building, research, and support work."
        actions={<StatusPill tone="positive"><ShieldCheck size={13} /> No API key stored</StatusPill>}
      />

      <section className="agent-lead card-surface">
        <span className="agent-lead__icon"><Bot size={30} /></span>
        <div>
          <span className="card-kicker">Your workflow, not another chatbot</span>
          <h2>Start with the right context.</h2>
          <p>
            Each desk copies a focused starter instruction and opens ChatGPT. Your account stays
            in the browser; XREAL WIN HUB never receives your password, chats, or API keys.
          </p>
        </div>
        <Sparkles className="agent-lead__spark" size={26} aria-hidden />
      </section>

      <section className="agent-grid">
        {AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <article className="agent-card" key={agent.id} style={{ '--agent-accent': agent.accent } as CSSProperties}>
              <div className="agent-card__top">
                <span><Icon size={22} /></span>
                <StatusPill tone="neutral">Prompt launcher</StatusPill>
              </div>
              <h2>{agent.name}</h2>
              <p>{agent.description}</p>
              <div className="agent-card__prompt">
                <span>Starts with</span>
                <q>{agent.prompt}</q>
              </div>
              <Button variant="primary" onClick={() => void launchAgent(agent)}>
                Launch desk <ArrowUpRight size={16} />
              </Button>
            </article>
          );
        })}
      </section>

      <section className="privacy-note">
        <LockKeyhole size={18} />
        <p>
          <strong>Privacy boundary:</strong> This release launches your existing ChatGPT session in
          the default browser. Direct API connections and secret storage are deliberately out of scope.
        </p>
      </section>
    </div>
  );
}
