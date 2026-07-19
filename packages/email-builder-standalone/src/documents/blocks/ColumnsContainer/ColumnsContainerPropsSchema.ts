import { ColumnsContainerPropsSchema } from '@eb/document-core';

export type ColumnsContainerProps = import('zod').infer<typeof ColumnsContainerPropsSchema>;
export default ColumnsContainerPropsSchema;
