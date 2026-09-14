/**
 * CommandPalette — Cmd/Ctrl+K searchable command panel for the editor.
 *
 * Built on the headless `@josecortez1/c42-react` <CommandPalette> controller
 * (vanilla-TS core, `data-c42-command-*` markup contract). The controller
 * owns behavior — global hotkey, filtering, keyboard nav, focus trap,
 * auto-close on select. We own the markup + styling, kept fully within the
 * monochrome editorial direction (paper surface, 1px border, dialog radius,
 * restrained accent only on the active row).
 *
 * Actions are wired to `EditorContext` setters. `onSelect` receives the
 * activated item's `data-value`; we parse a `namespace:arg` scheme and
 * dispatch. The controller closes itself after select (see core
 * `selectItem()` → `close()`), so handlers only perform the action.
 *
 * i18n: chrome + action labels via `common` namespace `commandPalette.*`.
 * Built-in block labels are localized via `BUTTONS[i].labelKey` (the same
 * `theme.blocks.*.title` keys used by the Blocks tab tiles).
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { CommandPalette as C42CommandPalette } from '@josecortez1/c42-react';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import DataObjectOutlined from '@mui/icons-material/DataObjectOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import LibraryAddOutlined from '@mui/icons-material/LibraryAddOutlined';
import MonitorOutlined from '@mui/icons-material/MonitorOutlined';
import PhoneIphoneOutlined from '@mui/icons-material/PhoneIphoneOutlined';
import RedoOutlined from '@mui/icons-material/RedoOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { alpha, Box } from '@mui/material';

import { RADIUS_DIALOG, RADIUS_INPUT } from '../../constants';
import {
  appendBuiltInBlockToParent,
  editorStateStore,
  redoChange,
  requestTourRestart,
  setComponentsLibraryDrawerOpen,
  setInspectorDrawerMode,
  setSelectedBlockId,
  setSelectedMainTab,
  setSelectedScreenSize,
  undoChange,
} from '../../documents/editor/EditorContext';
import { BUTTONS } from '../ComponentsLibrary/builtInBlocks';
import { dataTourAttr, EMAIL_BUILDER_TOUR_ANCHORS } from '../../tour/tourAnchors';

import ShortcutKeys from './ShortcutKeys';

/** A non-insert action row: fixed value + icon + i18n label key. */
type ActionDef = { value: string; icon: React.ReactElement; labelKey: string; shortcut?: string };

/** Detect Mac vs Win/Linux at module level (safe in browser). */
const IS_MAC = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const VIEW_ACTIONS: ActionDef[] = [
  {
    value: 'tab:editor',
    icon: <EditOutlined />,
    labelKey: 'commandPalette.action.tabEditor',
    shortcut: `${MOD}+E`,
  },
  {
    value: 'tab:preview',
    icon: <VisibilityOutlined />,
    labelKey: 'commandPalette.action.tabPreview',
    shortcut: `${MOD}+Shift+V`,
  },
  { value: 'tab:html', icon: <CodeOutlined />, labelKey: 'commandPalette.action.tabHtml' },
  { value: 'tab:json', icon: <DataObjectOutlined />, labelKey: 'commandPalette.action.tabJson' },
  {
    value: 'screen:desktop',
    icon: <MonitorOutlined />,
    labelKey: 'commandPalette.action.screenDesktop',
  },
  {
    value: 'screen:mobile',
    icon: <PhoneIphoneOutlined />,
    labelKey: 'commandPalette.action.screenMobile',
    shortcut: `${MOD}+M`,
  },
];

const LIBRARY_ACTIONS: ActionDef[] = [
  {
    value: 'library:toggle',
    icon: <LibraryAddOutlined />,
    labelKey: 'commandPalette.action.openLibrary',
    shortcut: `${MOD}+B`,
  },
  {
    value: 'inspector:toggle',
    icon: <TuneOutlined />,
    labelKey: 'commandPalette.action.toggleInspector',
    shortcut: `${MOD}+I`,
  },
];

const EDIT_ACTIONS: ActionDef[] = [
  {
    value: 'undo',
    icon: <UndoOutlined />,
    labelKey: 'commandPalette.action.undo',
    shortcut: `${MOD}+Z`,
  },
  {
    value: 'redo',
    icon: <RedoOutlined />,
    labelKey: 'commandPalette.action.redo',
    shortcut: `${MOD}+Y`,
  },
];

/**
 * Help entry that relaunches the product tour (F4,
 * docs/product-tour-driverjs-plan.md §4). Kept in its own group instead of
 * `EDIT_ACTIONS` — it's not an editing action, and a dedicated "Help" group
 * reads clearly even with a single entry today.
 */
const HELP_ACTIONS: ActionDef[] = [
  {
    value: 'tour:restart',
    icon: <HelpOutlineOutlined />,
    labelKey: 'commandPalette.action.tour',
  },
];

/** Parse and dispatch a selected command's `data-value`. */
function runCommand(value: string) {
  if (value.startsWith('insert:')) {
    const index = Number(value.slice('insert:'.length));
    const entry = BUTTONS[index];
    if (!entry) return;
    const newId = appendBuiltInBlockToParent('root', entry.block());
    if (newId) setSelectedBlockId(newId);
    return;
  }
  if (value.startsWith('tab:')) {
    setSelectedMainTab(value.slice('tab:'.length) as 'editor' | 'preview' | 'html' | 'json');
    return;
  }
  if (value.startsWith('screen:')) {
    const target = value.slice('screen:'.length) as 'desktop' | 'mobile';
    const current = editorStateStore.getState().selectedScreenSize ?? 'desktop';
    setSelectedScreenSize(current === target ? 'desktop' : target);
    return;
  }
  switch (value) {
    case 'library:toggle': {
      const isOpen = editorStateStore.getState().componentsLibraryDrawerOpen ?? false;
      setComponentsLibraryDrawerOpen(!isOpen);
      break;
    }
    case 'inspector:toggle': {
      const current = editorStateStore.getState().inspectorDrawerMode ?? 'full';
      setInspectorDrawerMode(current === 'compact' ? 'full' : 'compact');
      break;
    }
    case 'undo':
      undoChange();
      break;
    case 'redo':
      redoChange();
      break;
    case 'tour:restart':
      requestTourRestart();
      break;
  }
}

export default function CommandPalette() {
  const { t } = useTranslation('common');
  const { t: tInspector } = useTranslation('inspector');

  const handleSelect = useCallback((detail: unknown) => {
    const value = (detail as { value?: string })?.value;
    if (typeof value === 'string') runCommand(value);
  }, []);

  return (
    <Box
      sx={(theme) => ({
        display: 'contents',
        '& [data-c42-command-palette]:not([hidden])': {
          position: 'fixed',
          inset: 0,
          zIndex: 13000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        },
        '& [data-c42-command-overlay]': {
          position: 'fixed',
          inset: 0,
          backgroundColor: alpha('#000000', theme.palette.mode === 'dark' ? 0.6 : 0.35),
          backdropFilter: 'blur(2px)',
        },
        '& [data-c42-command-dialog]': {
          position: 'relative',
          marginTop: '12vh',
          width: 'min(560px, 92vw)',
          maxHeight: '62vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: `${RADIUS_DIALOG}px`,
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 8px 28px rgba(0,0,0,0.5)'
              : '0 8px 28px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        },
        '& [data-c42-command-input]': {
          appearance: 'none',
          border: 0,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
          padding: '16px 18px',
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.pxToRem(15),
          color: theme.palette.text.primary,
          backgroundColor: 'transparent',
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&::placeholder': { color: theme.palette.text.secondary },
        },
        '& [data-c42-command-list]': {
          overflowY: 'auto',
          padding: '8px',
        },
        '& [data-c42-command-group]': {
          marginBottom: '4px',
        },
        '& [data-c42-command-group]::before': {
          content: 'attr(data-label)',
          display: 'block',
          padding: '8px 10px 4px',
          fontSize: theme.typography.pxToRem(11),
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: theme.palette.text.secondary,
        },
        '& [data-c42-command-group][hidden]': { display: 'none' },
        '& [data-c42-command-item]': {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          boxSizing: 'border-box',
          textAlign: 'left',
          border: 0,
          background: 'transparent',
          padding: '8px 10px',
          borderRadius: `${RADIUS_INPUT}px`,
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.pxToRem(14),
          color: theme.palette.text.primary,
          cursor: 'pointer',
          transition: 'background-color 120ms ease',
          '& .MuiSvgIcon-root': { fontSize: 18, color: theme.palette.text.secondary },
          '& .cp-shortcut': { marginLeft: 'auto' },
        },
        '& [data-c42-command-item][hidden]': { display: 'none' },
        '& [data-c42-command-item]:hover, & [data-c42-command-item][data-active="true"]': {
          backgroundColor: theme.palette.action.hover,
        },
        '& [data-c42-command-empty]': {
          padding: '24px 10px',
          textAlign: 'center',
          color: theme.palette.text.secondary,
          fontSize: theme.typography.pxToRem(14),
        },
      })}
    >
      <C42CommandPalette hotkey="k" onSelect={handleSelect}>
        <div data-c42-command-overlay />
        <div data-c42-command-dialog {...dataTourAttr(EMAIL_BUILDER_TOUR_ANCHORS.commandPalette)}>
          <input
            data-c42-command-input
            placeholder={t('commandPalette.placeholder', 'Type a command or search…')}
          />
          <div data-c42-command-list>
            <div
              data-c42-command-group
              data-label={t('commandPalette.group.insert', 'Insert block')}
            >
              {BUTTONS.map((entry, index) => (
                <button
                  key={index}
                  type="button"
                  data-c42-command-item
                  data-value={`insert:${index}`}
                  data-keywords={`${entry.label.toLowerCase()} ${tInspector(entry.labelKey).toLowerCase()}`}
                >
                  {entry.icon}
                  <span>{tInspector(entry.labelKey)}</span>
                  {index < 8 && (
                    <span className="cp-shortcut">
                      <ShortcutKeys keys={[MOD, String(index + 1)]} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div data-c42-command-group data-label={t('commandPalette.group.view', 'View')}>
              {VIEW_ACTIONS.map((a) => (
                <button key={a.value} type="button" data-c42-command-item data-value={a.value}>
                  {a.icon}
                  <span>{t(a.labelKey)}</span>
                  {a.shortcut && (
                    <span className="cp-shortcut">
                      <ShortcutKeys shortcut={a.shortcut} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div data-c42-command-group data-label={t('commandPalette.group.library', 'Library')}>
              {LIBRARY_ACTIONS.map((a) => (
                <button key={a.value} type="button" data-c42-command-item data-value={a.value}>
                  {a.icon}
                  <span>{t(a.labelKey)}</span>
                  {a.shortcut && (
                    <span className="cp-shortcut">
                      <ShortcutKeys shortcut={a.shortcut} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div data-c42-command-group data-label={t('commandPalette.group.edit', 'Edit')}>
              {EDIT_ACTIONS.map((a) => (
                <button key={a.value} type="button" data-c42-command-item data-value={a.value}>
                  {a.icon}
                  <span>{t(a.labelKey)}</span>
                  {a.shortcut && (
                    <span className="cp-shortcut">
                      <ShortcutKeys shortcut={a.shortcut} />
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div data-c42-command-group data-label={t('commandPalette.group.help', 'Help')}>
              {HELP_ACTIONS.map((a) => (
                <button key={a.value} type="button" data-c42-command-item data-value={a.value}>
                  {a.icon}
                  <span>{t(a.labelKey)}</span>
                </button>
              ))}
            </div>

            <div data-c42-command-empty>{t('commandPalette.empty', 'No results')}</div>
          </div>
        </div>
      </C42CommandPalette>
    </Box>
  );
}
