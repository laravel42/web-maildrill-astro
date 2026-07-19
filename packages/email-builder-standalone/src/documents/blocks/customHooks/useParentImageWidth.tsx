import { useEffect } from 'react';

import { ImageProps } from '@eb/block-image';
import { shortCssId } from '@eb/email-builder';

import { useSelectedScreenSize } from '../../editor/EditorContext';

const useParentImageWidth = (blockId: string, setData: (v: ImageProps) => void, data: ImageProps) => {
  const selectedScreen = useSelectedScreenSize();

  useEffect(() => {
    const updateImageWidth = () => {
      if (!blockId || !document || selectedScreen == 'mobile') return;

      const sid = shortCssId(blockId);
      const imageElement = document.querySelector(`.${sid}`);
      if (!imageElement) return;

      const parentElement = imageElement.parentElement;

      if (!parentElement) return;

      const parentWidth = Math.ceil(parentElement.getBoundingClientRect().width);

      if (data.props?.size === undefined || data.props?.size === 'original') return;

      if (data.props?.touched && data.props?.width <= parentWidth) return;
      if (data.props?.width !== parentWidth && !data.props?.touched) {
        setData({
          ...data,
          props: {
            ...data.props,
            width: parentWidth,
          },
        });
      }
    };

    updateImageWidth();

    const resizeObserver = new ResizeObserver(updateImageWidth);

    const imageElement = document.querySelector(`.${shortCssId(blockId)}`);

    if (imageElement?.parentElement) {
      resizeObserver.observe(imageElement.parentElement);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [blockId, setData, data, selectedScreen]);
};

export default useParentImageWidth;
