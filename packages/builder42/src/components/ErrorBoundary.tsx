/**
 * ErrorBoundary — atrapa excepciones del render de un nodo del canvas sin
 * desmontar el árbol entero. Si `def.render(ctx)` lanza, solo ese nodo muestra
 * el fallback; el resto del canvas sigue funcionando.
 *
 * Se usa en dos niveles:
 *  - Canvas.tsx → envuelve el NodeRenderer raíz.
 *  - NodeRenderer.tsx → envuelve cada hijo recursivo, para que un fallo
 *    en un descendiente no reviente al padre (granularidad de nodo).
 *
 * Chrome del editor (P8): nunca se importa desde registry/ ni export/.
 * Clases CSS con prefijo `pbx-` (docs/22).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { CircleAlert } from "@/components";

interface ErrorBoundaryInnerProps {
  nodeId: string;
  nodeType: string | undefined;
  children: ReactNode;
  t: ReturnType<typeof useTranslation<"common">>["t"];
  select: (id: string | null) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<ErrorBoundaryInnerProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary] node ${this.props.nodeId} (${this.props.nodeType ?? "unknown"}):`,
      error,
      info.componentStack,
    );
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      const { nodeId, nodeType, t, select } = this.props;
      return (
        <AnimatePresence>
          <motion.div
            key={`err-${nodeId}`}
            className="pbx-error-boundary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <div className="pbx-error-boundary__header">
              <CircleAlert size={16} />
              <span className="pbx-error-boundary__title">
                {t("errorBoundary.renderError")}
              </span>
            </div>
            {nodeType ? (
              <p className="pbx-error-boundary__type">
                {t("errorBoundary.nodeType", { type: nodeType })}
              </p>
            ) : null}
            <p className="pbx-error-boundary__id">ID: {nodeId}</p>
            {this.state.error ? (
              <pre className="pbx-error-boundary__message">
                {this.state.error.message}
              </pre>
            ) : null}
            <div className="pbx-error-boundary__actions">
              <button
                type="button"
                className="pbx-error-boundary__btn pbx-error-boundary__btn--primary"
                onClick={() => select(nodeId)}
              >
                {t("errorBoundary.selectAndRepair")}
              </button>
              <button
                type="button"
                className="pbx-error-boundary__btn"
                onClick={this.reset}
              >
                {t("errorBoundary.retry")}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({
  nodeId,
  children,
}: {
  nodeId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("common");
  const select = useDocumentStore((s) => s.select);
  const nodeType = useDocumentStore((s) => s.document.nodes[nodeId]?.type);
  return (
    <ErrorBoundaryInner nodeId={nodeId} nodeType={nodeType} t={t} select={select}>
      {children}
    </ErrorBoundaryInner>
  );
}
