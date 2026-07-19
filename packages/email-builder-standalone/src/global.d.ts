declare module 'quill-emoji';

export type WindowTypes = {
  emailBuilderMergeTags: Record<string, any>;
  emailBuilderDevMode: boolean;
};

export interface EmailBuilderWindow extends Window {
  emailBuilder: WindowTypes;
}

export type EmitEvents = 'email-builder-auto-save';
