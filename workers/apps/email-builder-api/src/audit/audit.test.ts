import { describe, expect, it } from 'vitest';

import { analyzeTemplate, isSendReady } from './index.js';
import { columnWidths, htmlToText, resolveDocument, type EditorDocument } from './model.js';

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

/** Minimal well-formed document; helpers below mutate copies of it. */
function baseDocument(): EditorDocument {
  return {
    root: {
      type: 'EmailLayout',
      data: {
        canvasColor: '#FFFFFF',
        textColor: '#1F1E1B',
        backdropColor: '#F5F5F5',
        fontFamily: 'MODERN_SANS',
        childrenIds: ['headline', 'body', 'cta', 'footer'],
      },
    },
    headline: {
      type: 'NotionText',
      data: {
        style: { fontSize: 32, fontWeight: 'bold', color: '#1F1E1B', padding: { top: 24, bottom: 8, left: 24, right: 24 } },
        props: { html: '<h1>Your March report is ready</h1>' },
      },
    },
    body: {
      type: 'NotionText',
      data: {
        style: { fontSize: 16, color: '#3F3D39', padding: { top: 8, bottom: 16, left: 24, right: 24 } },
        props: {
          html: '<p>Revenue grew 12% against February, driven mostly by the new onboarding flow. The full breakdown is in the dashboard.</p>',
        },
      },
    },
    cta: {
      type: 'Button',
      data: {
        style: {
          fontSize: 16,
          fontWeight: 'bold',
          padding: { top: 14, bottom: 14, left: 28, right: 28 },
          buttonBackgroundColor: '#4F46E5',
          buttonTextColor: '#FFFFFF',
        },
        props: { text: 'Open the dashboard', url: 'https://maildrill.test/dashboard' },
      },
    },
    footer: {
      type: 'NotionText',
      data: {
        style: { fontSize: 12, color: '#6B6862', padding: { top: 16, bottom: 24, left: 24, right: 24 } },
        props: { html: '<p><a href="https://maildrill.test/unsubscribe">Unsubscribe</a> from these reports.</p>' },
      },
    },
  };
}

function findingIds(document: EditorDocument, options = {}): string[] {
  return analyzeTemplate(document, options).report.findings.map((f) => f.ruleId);
}

/* ------------------------------------------------------------------ */
/* model                                                               */
/* ------------------------------------------------------------------ */

describe('resolveDocument', () => {
  it('resolves inherited background, text colour, and content width', () => {
    const doc = resolveDocument({
      root: { type: 'EmailLayout', data: { canvasColor: '#FFFFFF', textColor: '#111111', childrenIds: ['box'] } },
      box: {
        type: 'Container',
        data: {
          style: { backgroundColor: '#000000', padding: { top: 10, bottom: 10, left: 50, right: 50 } },
          props: { childrenIds: ['text'] },
        },
      },
      text: { type: 'NotionText', data: { style: {}, props: { html: '<p>hi</p>' } } },
    });

    const text = doc.byId.get('text');
    expect(text?.background).toBe('#000000');
    // Inherited from the layout, since the block sets no colour of its own.
    expect(text?.textColor).toBe('#111111');
    // 600 canvas, less the container's 50+50, less the text block's own
    // default 24+24 — `contentWidth` is measured inside the block's padding.
    expect(text?.contentWidth).toBe(452);
  });

  it('records orphans and dangling references instead of throwing', () => {
    const doc = resolveDocument({
      root: { type: 'EmailLayout', data: { childrenIds: ['present', 'ghost'] } },
      present: { type: 'Spacer', data: { style: { height: 8 } } },
      stranded: { type: 'Spacer', data: { style: { height: 8 } } },
    });

    expect(doc.danglingRefs).toEqual([{ parentId: 'root', missingId: 'ghost' }]);
    expect(doc.orphanIds).toEqual(['stranded']);
  });

  it('treats fixedWidths as percentages of the available width', () => {
    // Regression: these were briefly read as pixels, which made a [7,54,39]
    // row report a 7px column.
    expect(columnWidths({ columnsCount: 3, fixedWidths: [7, 54, 39] }, 600)).toEqual([42, 324, 234]);
  });

  it('falls back to an even split when a width slot is null', () => {
    expect(columnWidths({ columnsCount: 2, fixedWidths: [null, null] }, 600)).toEqual([300, 300]);
  });

  it('decodes entities and block boundaries when extracting text', () => {
    expect(htmlToText('<p>Ben &amp; Co.</p><p>Second</p>')).toBe('Ben & Co.\nSecond');
  });
});

/* ------------------------------------------------------------------ */
/* the happy path                                                      */
/* ------------------------------------------------------------------ */

describe('analyzeTemplate', () => {
  it('passes a well-formed template with no blocking or major findings', () => {
    const { report } = analyzeTemplate(baseDocument());

    expect(report.severityCounts.P0).toBe(0);
    expect(report.severityCounts.P1).toBe(0);
    expect(isSendReady(report)).toBe(true);
    expect(report.overall).toBeGreaterThanOrEqual(80);
  });

  it('reports what it could not check rather than staying silent', () => {
    const { report } = analyzeTemplate(baseDocument());
    expect(report.notChecked.join(' ')).toMatch(/Preheader/);
    expect(report.notChecked.join(' ')).toMatch(/Image content/);
  });

  it('names strengths, not only faults', () => {
    const { report } = analyzeTemplate(baseDocument());
    expect(report.strengths.length).toBeGreaterThan(0);
    expect(report.strengths.join(' ')).toMatch(/contrast/i);
  });

  it('is deterministic', () => {
    const a = analyzeTemplate(baseDocument()).report;
    const b = analyzeTemplate(baseDocument()).report;
    expect(a.findings).toEqual(b.findings);
    expect(a.overall).toBe(b.overall);
  });
});

/* ------------------------------------------------------------------ */
/* structure                                                           */
/* ------------------------------------------------------------------ */

describe('structural rules', () => {
  it('flags a missing root as blocking', () => {
    const ids = findingIds({});
    expect(ids).toContain('structure/missing-root');
  });

  it('flags leftover placeholder copy as blocking', () => {
    const doc = baseDocument();
    doc.body.data.props = { html: '<p>Double click to edit...</p>' };
    expect(findingIds(doc)).toContain('structure/placeholder-content');
  });

  it('flags an unsubstituted generation token', () => {
    const doc = baseDocument();
    doc.headline.data.props = { html: '<h1>Welcome to {{ACCENT}}</h1>' };
    expect(findingIds(doc)).toContain('structure/placeholder-content');
  });

  it('flags orphaned blocks', () => {
    const doc = baseDocument();
    doc.stranded = { type: 'NotionText', data: { style: {}, props: { html: '<p>never rendered</p>' } } };
    expect(findingIds(doc)).toContain('structure/orphan-blocks');
  });
});

/* ------------------------------------------------------------------ */
/* accessibility                                                       */
/* ------------------------------------------------------------------ */

describe('accessibility rules', () => {
  it('catches insufficient text contrast and quotes the ratio', () => {
    const doc = baseDocument();
    doc.body.data.style = { ...(doc.body.data.style as object), color: '#BBBBBB' };

    const { report } = analyzeTemplate(doc);
    const hit = report.findings.find((f) => f.ruleId === 'a11y/text-contrast');
    expect(hit).toBeDefined();
    expect(hit?.detail).toMatch(/:1/);
    expect(hit?.standard).toMatch(/1\.4\.3/);
  });

  it('escalates to blocking when text is genuinely illegible', () => {
    const doc = baseDocument();
    doc.body.data.style = { ...(doc.body.data.style as object), color: '#F2F2F2' };

    const hit = analyzeTemplate(doc).report.findings.find((f) => f.ruleId === 'a11y/text-contrast');
    expect(hit?.severity).toBe('P0');
  });

  it('catches low-contrast button labels', () => {
    const doc = baseDocument();
    doc.cta.data.style = { ...(doc.cta.data.style as object), buttonTextColor: '#8C86F0' };
    expect(findingIds(doc)).toContain('a11y/button-contrast');
  });

  it('flags missing image alt text', () => {
    const doc = baseDocument();
    doc.root.data.childrenIds = ['hero', ...(doc.root.data.childrenIds as string[])];
    doc.hero = { type: 'Image', data: { style: {}, props: { url: 'https://cdn.test/a.png', alt: '' } } };
    expect(findingIds(doc)).toContain('a11y/image-alt-missing');
  });

  it('treats a filename as no better than missing alt text', () => {
    const doc = baseDocument();
    doc.root.data.childrenIds = ['hero', ...(doc.root.data.childrenIds as string[])];
    doc.hero = { type: 'Image', data: { style: {}, props: { url: 'https://cdn.test/a.png', alt: 'hero-image-2.png' } } };
    expect(findingIds(doc)).toContain('a11y/image-alt-filename');
  });

  it('allows a small footer but flags small running copy', () => {
    // The 12px footer in the base fixture is a convention, not a defect.
    expect(findingIds(baseDocument())).not.toContain('a11y/body-text-small');

    const doc = baseDocument();
    doc.body.data.style = { ...(doc.body.data.style as object), fontSize: 12 };
    doc.body.data.props = {
      html: `<p>${'This is a long paragraph of running copy that a reader has to sustain attention through. '.repeat(3)}</p>`,
    };
    expect(findingIds(doc)).toContain('a11y/body-text-small');
  });

  it('separates the 24px conformance floor from the 44px comfort target', () => {
    const doc = baseDocument();
    doc.cta.data.style = { ...(doc.cta.data.style as object), fontSize: 12, padding: { top: 0, bottom: 0, left: 20, right: 20 } };
    expect(findingIds(doc)).toContain('a11y/tap-target-fails-minimum');

    const roomy = baseDocument();
    roomy.cta.data.style = { ...(roomy.cta.data.style as object), padding: { top: 8, bottom: 8, left: 20, right: 20 } };
    expect(findingIds(roomy)).toContain('a11y/tap-target-below-target');
  });

  it('flags non-descriptive link text', () => {
    const doc = baseDocument();
    doc.body.data.props = { html: '<p>For the numbers, <a href="https://maildrill.test/x">click here</a>.</p>' };
    expect(findingIds(doc)).toContain('a11y/vague-link-text');
  });
});

/* ------------------------------------------------------------------ */
/* client compatibility                                                */
/* ------------------------------------------------------------------ */

describe('client compatibility rules', () => {
  it('flags a display web font with no named fallback and names the clients', () => {
    const doc = baseDocument();
    doc.headline.data.style = { ...(doc.headline.data.style as object), fontFamily: 'PACIFICO' };

    const hit = analyzeTemplate(doc).report.findings.find((f) => f.ruleId === 'compat/web-font-no-fallback');
    expect(hit).toBeDefined();
    expect(hit?.clients?.join(' ')).toMatch(/Outlook/);
  });

  it('stays quiet about system font stacks', () => {
    expect(findingIds(baseDocument())).not.toContain('compat/web-font-no-fallback');
    expect(findingIds(baseDocument())).not.toContain('compat/web-font-generic-fallback');
  });

  it('flags object-fit, which silently distorts images in Outlook', () => {
    const doc = baseDocument();
    doc.root.data.childrenIds = ['hero', ...(doc.root.data.childrenIds as string[])];
    doc.hero = {
      type: 'Image',
      data: { style: { objectFit: 'cover', height: 200 }, props: { url: 'https://cdn.test/a.png', alt: 'Team at work' } },
    };
    expect(findingIds(doc)).toContain('compat/object-fit');
  });

  it('flags three-column rows that cannot stack where <style> is stripped', () => {
    const doc = baseDocument();
    doc.root.data.childrenIds = ['cols', ...(doc.root.data.childrenIds as string[])];
    doc.cols = {
      type: 'ColumnsContainer',
      data: {
        style: {},
        props: {
          columnsCount: 3,
          fixedWidths: [33, 34, 33],
          columns: [{ childrenIds: ['c1'] }, { childrenIds: [] }, { childrenIds: [] }],
        },
      },
    };
    doc.c1 = { type: 'NotionText', data: { style: {}, props: { html: '<p>One</p>' } } };
    expect(findingIds(doc)).toContain('compat/three-column-no-stack');
  });
});

/* ------------------------------------------------------------------ */
/* deliverability                                                      */
/* ------------------------------------------------------------------ */

describe('deliverability rules', () => {
  it('treats an unset href as blocking for a campaign but minor for a template', () => {
    const doc = baseDocument();
    doc.cta.data.props = { text: 'Open the dashboard', url: '#' };

    const campaign = analyzeTemplate(doc, { intent: 'campaign' }).report.findings.find(
      (f) => f.ruleId === 'deliver/placeholder-href',
    );
    const template = analyzeTemplate(doc, { intent: 'template' }).report.findings.find(
      (f) => f.ruleId === 'deliver/placeholder-href',
    );

    expect(campaign?.severity).toBe('P0');
    expect(template?.severity).toBe('P2');
  });

  it('flags a link that cannot resolve without a base URL', () => {
    const doc = baseDocument();
    doc.cta.data.props = { text: 'Open the dashboard', url: '/dashboard' };
    expect(findingIds(doc)).toContain('deliver/relative-href');
  });

  it('accepts a merge tag as a destination', () => {
    const doc = baseDocument();
    doc.cta.data.props = { text: 'Open the dashboard', url: '{{dashboard_url}}' };
    expect(findingIds(doc)).not.toContain('deliver/relative-href');
  });

  it('flags a missing unsubscribe path', () => {
    const doc = baseDocument();
    doc.footer.data.props = { html: '<p>Thanks for reading.</p>' };
    expect(findingIds(doc)).toContain('deliver/no-unsubscribe');
  });

  it('reviews the subject line only when one is supplied', () => {
    expect(findingIds(baseDocument())).not.toContain('deliver/subject-shouty');
    expect(findingIds(baseDocument(), { subject: 'ACT NOW!!!' })).toContain('deliver/subject-shouty');
  });
});

/* ------------------------------------------------------------------ */
/* design signals                                                      */
/* ------------------------------------------------------------------ */

describe('design rules', () => {
  it('flags a flat type scale', () => {
    const doc = baseDocument();
    doc.headline.data.style = { ...(doc.headline.data.style as object), fontSize: 18 };
    expect(findingIds(doc)).toContain('design/flat-type-scale');
  });

  it('flags an email with no call to action', () => {
    const doc = baseDocument();
    doc.root.data.childrenIds = ['headline', 'body', 'footer'];
    delete doc.cta;
    expect(findingIds(doc)).toContain('design/no-call-to-action');
  });

  it('flags competing calls to action', () => {
    const doc = baseDocument();
    for (const n of [1, 2, 3, 4]) {
      doc[`cta${n}`] = {
        type: 'Button',
        data: {
          style: { buttonBackgroundColor: '#4F46E5', buttonTextColor: '#FFFFFF' },
          props: { text: `Action ${n}`, url: `https://maildrill.test/${n}` },
        },
      };
    }
    doc.root.data.childrenIds = [...(doc.root.data.childrenIds as string[]), 'cta1', 'cta2', 'cta3', 'cta4'];
    expect(findingIds(doc)).toContain('design/competing-ctas');
  });

  it('flags a design with nothing identifying the sender', () => {
    const doc = baseDocument();
    doc.cta.data.style = { ...(doc.cta.data.style as object), buttonBackgroundColor: '#333333' };
    doc.spacerA = { type: 'Spacer', data: { style: { height: 8 } } };
    doc.spacerB = { type: 'Spacer', data: { style: { height: 8 } } };
    doc.spacerC = { type: 'Spacer', data: { style: { height: 8 } } };
    doc.root.data.childrenIds = [...(doc.root.data.childrenIds as string[]), 'spacerA', 'spacerB', 'spacerC'];
    expect(findingIds(doc)).toContain('design/category-interchangeable');
  });
});

/* ------------------------------------------------------------------ */
/* scoring                                                             */
/* ------------------------------------------------------------------ */

describe('scoring', () => {
  it('renormalises the denominator when a dimension does not apply', () => {
    // No images and a short body: imagery cannot be judged, so it should be
    // dropped from the maximum rather than scored.
    const doc = baseDocument();
    const { report } = analyzeTemplate(doc);
    const imagery = report.critique.dimensions.find((d) => d.dimension === 'imagery');

    expect(imagery?.score).toBeNull();
    expect(imagery?.notApplicableReason).toBeTruthy();
    expect(report.critique.max).toBeLessThan(40);
  });

  it('floors a dimension on a single blocking finding', () => {
    const { report } = analyzeTemplate({});
    const structural = report.audit.dimensions.find((d) => d.dimension === 'structuralIntegrity');
    expect(structural?.score).toBe(0);
  });

  it('orders findings worst-first', () => {
    const doc = baseDocument();
    doc.body.data.props = { html: '<p>Lorem ipsum dolor sit amet</p>' };
    doc.cta.data.style = { ...(doc.cta.data.style as object), padding: { top: 8, bottom: 8, left: 20, right: 20 } };

    const { report } = analyzeTemplate(doc);
    const severities = report.findings.map((f) => f.severity);
    const rank = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
    expect(severities).toEqual([...severities].sort((a, b) => rank[a] - rank[b]));
  });

  it('survives a malformed document without throwing', () => {
    const junk = {
      root: { type: 'EmailLayout', data: { childrenIds: ['a'] } },
      a: { type: 'NotionText', data: { style: { fontSize: 'huge', color: 'not-a-colour' }, props: { html: 42 } } },
    } as unknown as EditorDocument;

    expect(() => analyzeTemplate(junk)).not.toThrow();
  });
});
