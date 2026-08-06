import { describe, expect, it } from 'vitest';
import { validateWaTemplateSubmit } from '@/lib/app/wa-submit-validation';

describe('validateWaTemplateSubmit', () => {
  it('blocks COPY_CODE without example', () => {
    expect(
      validateWaTemplateSubmit({
        name: 'birthday_offer',
        text: 'Hi {{1}}',
        components: {
          category: 'MARKETING',
          body: { text: 'Hi {{1}}', examples: ['Alex'] },
          buttons: [{ type: 'COPY_CODE' }],
        },
      }),
    ).toMatch(/Copy offer code/);
  });

  it('blocks invalid template names', () => {
    expect(
      validateWaTemplateSubmit({
        name: "Jose's Birthday",
        text: 'Hello',
        components: { category: 'MARKETING', body: { text: 'Hello' } },
      }),
    ).toMatch(/Rename the template/);
  });
});
