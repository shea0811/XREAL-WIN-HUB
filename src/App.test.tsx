/**
 * @vitest-environment jsdom
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { platform } from './services/platform';
import { HubProvider } from './state/HubContext';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('application shell', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    await platform.setSimulationMode(false);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  async function renderApp() {
    await act(async () => {
      root.render(
        <HubProvider>
          <App />
        </HubProvider>,
      );
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }

  function buttonContaining(text: string, scope: ParentNode = container) {
    return Array.from(scope.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(text),
    );
  }

  async function click(button: Element | undefined) {
    expect(button).toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.restoreAllMocks();
  });

  it('hydrates the dashboard and navigates between modules', async () => {
    await renderApp();

    expect(container.textContent).toContain('Command centre');
    expect(container.textContent).toContain('XREAL');
    expect(container.textContent).toContain('WIN HUB');

    const notesButton = buttonContaining('Notes & study');
    await click(notesButton);
    expect(container.textContent).toContain('Local notebook');
    expect(container.textContent).toContain('Welcome to XREAL WIN HUB');
  });

  it('opens every primary module without a render failure', async () => {
    await renderApp();
    const modules = [
      ['XREAL device', 'XREAL device centre'],
      ['Display Layout Studio', 'Desktop coordinate space'],
      ['Entertainment', 'Choose what plays in the Hub'],
      ['WhatsApp', 'WhatsApp Web needs the installed Windows app'],
      ['Notes & study', 'Local notebook'],
      ['Workspaces', 'One-click setups'],
      ['Gestures', 'Gesture studio'],
      ['Agent desk', 'AI launchpad'],
      ['Settings', 'Privacy & data'],
      ['Home', 'Quick launch'],
    ];

    for (const [navigationLabel, expectedText] of modules) {
      await click(buttonContaining(navigationLabel));
      expect(container.textContent).toContain(expectedText);
    }
  });

  it('simulates connecting and disconnecting an XREAL One Pro', async () => {
    await renderApp();
    await click(buttonContaining('XREAL device'));
    expect(container.textContent).toContain('Not detected');

    await click(buttonContaining('Simulate One Pro'));

    expect(container.textContent).toContain('XREAL One Pro (simulated)');
    expect(container.textContent).toContain('Simulation connected');
    expect(container.textContent).toContain('Disconnect simulator');
    expect(container.textContent).toContain('One Pro simulated');
    expect((buttonContaining('Move hub to display') as HTMLButtonElement).disabled).toBe(false);

    await click(buttonContaining('Disconnect simulator'));
    expect(container.textContent).toContain('Not detected');
  });

  it('opens Layout Studio with a simulated One Pro and previews a safe arrangement', async () => {
    await renderApp();
    await click(buttonContaining('XREAL device'));
    await click(buttonContaining('Simulate One Pro'));
    await click(buttonContaining('Display Layout Studio'));

    expect(container.textContent).toContain('XREAL One Pro (simulated)');
    expect(container.textContent).toContain('XREAL FOV');
    expect(container.textContent).toContain('Safe preview mode');

    const xInput = container.querySelector<HTMLInputElement>('[aria-label="X position"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(xInput, '-1920');
      xInput?.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    await click(buttonContaining('Preview'));
    expect(container.textContent).toContain('Can you see every display?');
    await click(buttonContaining('Keep changes'));
    expect(container.textContent).not.toContain('Can you see every display?');
  });

  it('runs gesture actions and creates a local quick note', async () => {
    await renderApp();
    await click(buttonContaining('Gestures'));
    const gestureRow = Array.from(container.querySelectorAll('.gesture-row')).find((row) =>
      row.textContent?.includes('Double pinch'),
    );
    expect(gestureRow).toBeDefined();
    await click(buttonContaining('Test', gestureRow));

    expect(container.textContent).toContain('Local notebook');
    expect(container.textContent).toContain('Untitled note');
    expect(container.textContent).toContain('Double pinch recognised');
  });

  it('creates, edits, and searches a local note', async () => {
    await renderApp();
    await click(buttonContaining('Notes & study'));
    await click(buttonContaining('New page'));

    const titleInput = container.querySelector<HTMLInputElement>('[aria-label="Note title"]');
    const bodyInput = container.querySelector<HTMLTextAreaElement>('[aria-label="Note body"]');
    expect(titleInput).not.toBeNull();
    expect(bodyInput).not.toBeNull();

    await act(async () => {
      const titleSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      const bodySetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      titleSetter?.call(titleInput, 'One Pro test notes');
      titleInput?.dispatchEvent(new Event('input', { bubbles: true }));
      bodySetter?.call(bodyInput, 'Display placement and gesture checks passed.');
      bodyInput?.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('One Pro test notes');
    expect(container.textContent).toContain('6 words');

    const search = container.querySelector<HTMLInputElement>('[aria-label="Search notes"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(search, 'One Pro test');
      search?.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelectorAll('.note-list-item')).toHaveLength(1);
  });

  it('creates a notebook, section, and page using in-app dialogs', async () => {
    await renderApp();
    await click(buttonContaining('Notes & study'));

    await click(container.querySelector<HTMLButtonElement>('[aria-label="New notebook"]') ?? undefined);
    const notebookDialog = container.querySelector('[aria-label="Create notebook"]');
    expect(notebookDialog).not.toBeNull();
    const notebookName = notebookDialog?.querySelector<HTMLInputElement>('[aria-label="Notebook name"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(notebookName, 'Cybersecurity');
      notebookName?.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    await click(buttonContaining('Create notebook', notebookDialog ?? container));
    expect(container.textContent).toContain('Cybersecurity');

    await click(container.querySelector<HTMLButtonElement>('[aria-label="New section"]') ?? undefined);
    const sectionDialog = container.querySelector('[aria-label="Create section"]');
    const sectionName = sectionDialog?.querySelector<HTMLInputElement>('[aria-label="Section name"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(sectionName, 'BRIM');
      sectionName?.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });
    await click(buttonContaining('Create section', sectionDialog ?? container));
    expect(container.textContent).toContain('BRIM');

    await click(buttonContaining('New page'));
    expect(container.textContent).toContain('Untitled note');
    expect(container.textContent).toContain('Page created');
  });

  it('stores alerts in the notification centre and moves activity into Settings', async () => {
    await renderApp();
    expect(container.textContent).not.toContain('Recent activity');

    await click(buttonContaining('XREAL device'));
    await click(buttonContaining('Simulate One Pro'));

    const notificationButton = container.querySelector<HTMLButtonElement>('[aria-label^="Open notifications"]');
    await click(notificationButton ?? undefined);
    expect(container.querySelector('[aria-label="Notification centre"]')).not.toBeNull();
    expect(container.textContent).toContain('Simulated One Pro connected');

    await click(container.querySelector<HTMLButtonElement>('[aria-label="Close notifications"]') ?? undefined);
    await click(buttonContaining('Settings'));
    expect(container.textContent).toContain('Recent activity');
    expect(container.textContent).toContain('One Pro simulator connected');
  });

  it('keeps integrated media in the Hub and launches external services safely', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await renderApp();

    await click(buttonContaining('Entertainment'));
    await click(buttonContaining('YouTube'));
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('YouTube');
    expect(container.querySelector('[aria-label="YouTube player"]')).not.toBeNull();
    expect(open).not.toHaveBeenCalled();

    await click(buttonContaining('Netflix'));
    expect(open).toHaveBeenCalledWith('https://www.netflix.com', '_blank', 'noopener,noreferrer');
    expect(container.textContent).toContain('Netflix opened');

    await click(buttonContaining('Workspaces'));
    const studyWorkspace = Array.from(container.querySelectorAll('.workspace-card')).find((card) =>
      card.textContent?.includes('Study session'),
    );
    await click(buttonContaining('Launch', studyWorkspace));
    expect(open).toHaveBeenCalledWith('https://chatgpt.com', '_blank', 'noopener,noreferrer');
    expect(open).toHaveBeenCalledWith('https://learn.microsoft.com/training/', '_blank', 'noopener,noreferrer');
    expect(container.textContent).toContain('Study session launched');

    await click(buttonContaining('Agent desk'));
    const studyAgent = Array.from(container.querySelectorAll('.agent-card')).find((card) =>
      card.textContent?.includes('Study partner'),
    );
    await click(buttonContaining('Launch desk', studyAgent));
    expect(open).toHaveBeenCalledWith('https://chatgpt.com', '_blank', 'noopener,noreferrer');
    expect(container.textContent).toContain('Study partner is ready');
  });

  it('offers WhatsApp as an isolated installed-app workspace', async () => {
    await renderApp();
    await click(buttonContaining('WhatsApp'));
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('WhatsApp');
    expect(container.querySelector('[aria-label="WhatsApp Web workspace"]')).not.toBeNull();
    expect(container.textContent).toContain('Isolated by design');
    expect(container.textContent).toContain('installed Windows app');
  });

  it('opens global Spotify and YouTube controls beside display status', async () => {
    await renderApp();

    await click(container.querySelector<HTMLButtonElement>('[aria-label="Open Spotify controls"]') ?? undefined);
    expect(container.querySelector('[aria-label="Spotify controls"]')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Previous"]')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Play"]')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Next"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="Spotify volume"]')).not.toBeNull();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Home');

    await click(container.querySelector<HTMLButtonElement>('[aria-label="Open YouTube controls"]') ?? undefined);
    expect(container.querySelector('[aria-label="YouTube controls"]')).not.toBeNull();
    expect(container.querySelector<HTMLInputElement>('[aria-label="YouTube volume"]')).not.toBeNull();
    expect(container.querySelector('[aria-current="page"]')?.textContent).toContain('Home');
  });

  it('applies appearance settings and operates the command palette', async () => {
    await renderApp();
    await click(buttonContaining('Settings'));
    await click(buttonContaining('Light'));
    expect(document.documentElement.dataset.theme).toBe('light');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(container.querySelector('[aria-label="Command palette"]')).not.toBeNull();
    await click(buttonContaining('Create a quick note'));
    expect(container.textContent).toContain('Local notebook');
    expect(container.textContent).toContain('Untitled note');
  });
});
