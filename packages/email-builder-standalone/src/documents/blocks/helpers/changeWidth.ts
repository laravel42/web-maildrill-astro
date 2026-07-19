import { ImageProps } from '@eb/block-image';
import { shortCssId } from '@eb/email-builder';

export const changeWidth = (blockId: string, setData: (v: ImageProps) => void, data: ImageProps) => {
  if (!blockId || !document) return;

  const sid = shortCssId(blockId);
  const imageElement = document.querySelector(`.${sid}`);

  if (!imageElement) return;

  const parentElement = imageElement.parentElement;

  if (!parentElement) return;

  const parentWidth = Math.ceil(parentElement.getBoundingClientRect().width);

  if (data.props?.touched) return;

  if (data.props?.width !== parentWidth) {
    setData({
      ...data,
      props: {
        ...data.props,
        width: parentWidth,
      },
    });
  }
};

export const getParentWidth = (blockId: string | null) => {
  if (!blockId || !document) return;

  const sid = shortCssId(blockId);
  const imageElement = document.querySelector(`.${sid}`);

  if (!imageElement) return;

  const parentElement = imageElement.parentElement;

  if (!parentElement) return;
  const parentElementWidth = Math.ceil(parentElement.getBoundingClientRect().width);

  if (parentElementWidth) {
    return parentElementWidth;
  }
  return null;
};
