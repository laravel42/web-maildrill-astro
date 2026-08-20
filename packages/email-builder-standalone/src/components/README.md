# Sample Image Gallery Component

Example implementation of a custom image provider for the Email Builder.

## Features

- Displays current image from the selected block
- Shows a gallery of sample images
- Click to select and apply images immediately
- Visual indicator for the currently selected image

## Implementation

### Event Listener

```typescript
useEffect(() => {
  const handlePanelOpened = (event: Event) => {
    const customEvent = event as CustomEvent<ImagePanelOpenedDetail>;
    const { blockId, currentImageUrl, alt } = customEvent.detail;

    setCurrentBlockId(blockId);
    setCurrentImageUrl(currentImageUrl);
    setCurrentAlt(alt);
  };

  window.addEventListener('email-builder-image-panel-opened', handlePanelOpened);

  return () => {
    window.removeEventListener('email-builder-image-panel-opened', handlePanelOpened);
  };
}, []);
```

### Image Selection

```typescript
const handleImageClick = (imageUrl: string) => {
  window.dispatchEvent(
    new CustomEvent('email-builder-set-image', {
      detail: imageUrl,
    }),
  );

  setCurrentImageUrl(imageUrl);
};
```

## Usage

```tsx
import SampleImageGallery from './components/SampleImageGallery';
import { EmailBuilder } from 'email-builder-standalone';

function App() {
  return (
    <EmailBuilder
      customImageProvider={<SampleImageGallery />}
      // ... other props
    />
  );
}
```

## Customization

Replace `SAMPLE_IMAGES` with your own image source:

```typescript
// From API
useEffect(() => {
  fetch('/api/images')
    .then((res) => res.json())
    .then((data) => setImages(data));
}, []);

// From props
function MyImageGallery({ images }) {
  // Use images prop
}
```

## Event Types

```typescript
interface ImagePanelOpenedDetail {
  blockId: string;
  currentImageUrl: string | null;
  alt: string | null;
}
```
