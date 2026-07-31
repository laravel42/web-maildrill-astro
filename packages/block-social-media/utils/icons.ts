export const URL_BASE = 'https://maildrill-dev.s3.us-east-2.amazonaws.com/icons/';

// Types and Interfaces
export type ThemeType = 'positive' | 'original' | 'negative';
export type SizeType = 'small' | 'medium' | 'large';
export const ValidTheme = {
  positive: true,
  original: true,
  negative: true,
};
export const ValidSize = {
  small: true,
  medium: true,
  large: true,
  xlarge: true,
};

export interface IconOptions {
  key: string;
  label: string;
  iconName: string;
  theme: ThemeType | string;
  size: SizeType | string;
  sizePx: string;
  href?: string | null;
  url: string;
  id?: string;
}
const DEFAULT_ICON_OPTIONS = {
  theme: 'positive' as ThemeType,
  size: 'medium' as SizeType,
};

export const getIconUrl = (
  iconName: string,
  theme: ThemeType,
  size: SizeType = 'medium',
): string => {
  const sizeValue = optionsSizes.find((opt) => opt.key === size)?.value;
  const themeValue = optionsThemes.find((opt) => opt.key === theme)?.value;
  return `${URL_BASE}${iconName}_${themeValue}_${sizeValue}.png`;
};
export const getSize = (size: string) => {
  return optionsSizes.find((opt) => opt.key === size)?.value || '36px';
};

export const optionsSizes: { key: SizeType; label: string; value: string }[] = [
  {
    value: '24px',
    key: 'small',
    label: 'Small',
  },
  {
    value: '36px',
    key: 'medium',
    label: 'Medium',
  },
  {
    value: '48px',
    key: 'large',
    label: 'Large',
  },
];

export const optionsThemes: { key: ThemeType; label: string; value: string }[] = [
  {
    value: 'Positive',
    key: 'positive',
    label: 'Light',
  },
  {
    value: 'Original',
    key: 'original',
    label: 'Color',
  },
  {
    value: 'Negative',
    key: 'negative',
    label: 'Dark',
  },
];

export const options: IconOptions[] = [
  {
    key: 'facebook',
    label: 'Facebook',
    iconName: 'Facebook',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Facebook', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.facebook.com/your-profile',
  },
  {
    key: 'web',
    label: 'Web',
    iconName: 'Web',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Web', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.google.com',
  },
  {
    key: 'mail',
    label: 'Mail',
    iconName: 'Mail',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Mail', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://mail.google.com/',
  },
  {
    key: 'apple',
    label: 'Apple',
    iconName: 'Apple',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Apple', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.apple.com/',
  },
  {
    key: 'bluesky',
    label: 'Bluesky',
    iconName: 'Bluesky',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Bluesky', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://bsky.app/',
  },
  {
    key: 'clubhouse',
    label: 'ClubHouse',
    iconName: 'Clubhouse',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Clubhouse', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.clubhouse.com/',
  },
  {
    key: 'dribbble',
    label: 'Dribbble',
    iconName: 'Dribbble',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Dribbble', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://dribbble.com/',
  },
  {
    key: 'figma',
    label: 'Figma',
    iconName: 'Figma',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Figma', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.figma.com/',
  },
  {
    key: 'github',
    label: 'Github',
    iconName: 'Github',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Github', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://github.com/',
  },
  {
    key: 'google',
    label: 'Google',
    iconName: 'Google',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Google', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://google.com/',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    iconName: 'Instagram',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Instagram', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.instagram.com/your-profile',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    iconName: 'LinkedIn',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('LinkedIn', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.linkedin.com/in/your-profile',
  },
  {
    key: 'medium-social',
    label: 'Medium',
    iconName: 'Medium',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Medium', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://medium.com/',
  },
  {
    key: 'messenger',
    label: 'Messenger',
    iconName: 'Messenger',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Messenger', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.messenger.com/',
  },
  {
    key: 'pinterest',
    label: 'Pinterest',
    iconName: 'Pinterest',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Pinterest', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.pinterest.com/',
  },
  {
    key: 'reddit',
    label: 'Reddit',
    iconName: 'Reddit',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Reddit', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.reddit.com/',
  },
  {
    key: 'signal',
    label: 'Signal',
    iconName: 'Signal',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Signal', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://signal.org/',
  },
  {
    key: 'snapchat',
    label: 'Snapchat',
    iconName: 'Snapchat',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Snapchat', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.snapchat.com/',
  },
  {
    key: 'spotify',
    label: 'Spotify',
    iconName: 'Spotify',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Spotify', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.spotify.com/',
  },
  {
    key: 'telegram',
    label: 'Telegram',
    iconName: 'Telegram',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Telegram', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://t.me/your-profile',
  },
  {
    key: 'threads',
    label: 'Threads',
    iconName: 'Threads',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Threads', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.threads.net/',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    iconName: 'TikTok',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('TikTok', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.tiktok.com/@your-profile',
  },
  {
    key: 'tumblr',
    label: 'Tumblr',
    iconName: 'Tumblr',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Tumblr', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.tumblr.com/',
  },
  {
    key: 'twitch',
    label: 'Twitch',
    iconName: 'Twitch',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('Twitch', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.twitch.tv/',
  },
  {
    key: 'vk',
    label: 'VK',
    iconName: 'VK',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('VK', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://vk.com/',
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    iconName: 'WhatsApp',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('WhatsApp', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.whatsapp.com/',
  },
  {
    key: 'x',
    label: 'X',
    iconName: 'X',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('X', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://x.com/your-profile',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    iconName: 'YouTube',
    theme: DEFAULT_ICON_OPTIONS.theme,
    size: DEFAULT_ICON_OPTIONS.size,
    sizePx: getSize(DEFAULT_ICON_OPTIONS.size),
    url: getIconUrl('YouTube', DEFAULT_ICON_OPTIONS.theme, DEFAULT_ICON_OPTIONS.size),
    href: 'https://www.youtube.com/channel/your-channel-id',
  },
];
