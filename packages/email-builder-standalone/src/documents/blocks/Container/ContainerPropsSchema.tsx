import { ContainerPropsSchema } from '@eb/document-core';

export default ContainerPropsSchema;

export type ContainerProps = import('zod').infer<typeof ContainerPropsSchema>;
