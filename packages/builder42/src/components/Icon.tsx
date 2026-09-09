/**
 * Icon — punto único de importación de iconos Lucide para el CHROME del editor
 * (Fase 11.f, docs/18). Los consumers (`app/`, `inspector/`, `components/`)
 * importan desde aquí (vía `@/components`), nunca directo de `lucide-react`.
 *
 * Excepción documentada a P10 (AGENTS.md §5.2): Lucide es un set de iconos
 * (assets SVG con `currentColor`), no una librería de controladores de UI; no
 * sustituye a c42 para lógica de UI.
 *
 * Regla dura (P8): esto es chrome del editor. Nunca se importa desde
 * `registry/components/` ni desde `export/` — el sitio exportado es cero-JS y
 * usa sus propios SVG inline.
 *
 * Los iconos aceptan `size`, `strokeWidth`, `className` y `color` (usan
 * `currentColor` por defecto), igual que el patrón previo de SVG inline.
 */

export {
  // ---- Acciones / historial -------------------------------------------
  Undo2 as UndoIcon,
  Redo2 as RedoIcon,
  X as CloseIcon,
  RotateCcw as ResetIcon,
  Link2 as LinkIcon,
  TriangleAlert as WarnIcon,
  ChevronUp,
  ChevronDown,
  // ---- CRUD / reordenamiento (Fase 19.b) ------------------------------
  ArrowUp,
  ArrowDown,
  House,
  Copy,
  Star,
  // ---- Site settings tabs + info (Fase 19.f) --------------------------
  Info,
  FileText,
  Search,
  Save,
  // ---- Viewports ------------------------------------------------------
  Smartphone,
  Tablet,
  Monitor,
  // ---- Tema (Fase 11.d) + perfil / idioma -----------------------------
  Sun,
  Moon,
  MonitorCog,
  CircleUserRound,
  Settings,
  Globe,
  // ---- Categorías del sidebar -----------------------------------------
  LayoutGrid,
  Navigation,
  // ---- Grupos de estilo / props (Inspector) ---------------------------
  Move,
  Ruler,
  Palette,
  SlidersHorizontal,
  Plus,
  ChevronRight,
  ChevronLeft,
  // ---- Behaviors (interactividad) -------------------------------------
  GalleryHorizontal,
  Eye,
  SunMoon,
  Zap,
  // ---- Varios del chrome ----------------------------------------------
  GripVertical,
  EyeOff,
  Layers,
  Check,
  Ellipsis,
  // ---- Reordenamiento por flechas (docs/24 §2) ------------------------
  ArrowUpDown,
  // Outdent/indent (docs/24 §2 + §4): iconos semánticos de "sacar/meter del
  // contenedor" — reemplazan ArrowLeft/ArrowRight (feedback de usuario: sin
  // tooltip visible en touch, izquierda/derecha no comunican la acción).
  ListIndentDecrease as OutdentIcon,
  ListIndentIncrease as IndentIcon,
  // ---- Tipos de componente (ComponentTypeIcon) ------------------------
  Square,
  Type,
  Image as ImageIcon,
  RectangleHorizontal,
  ChevronsUpDown,
  TextCursorInput,
  SquarePen,
  Code,
  Braces,
  Tag,
  ClipboardList,
  SendHorizontal,
  Languages,
  Minus,
  MoveVertical,
  Frame,
  Badge,
  Shapes,
  Quote,
  TrendingUp,
  UserRound,
  Video,
  SquareStack,
  PanelTop,
  MessageSquareQuote,
  BadgeDollarSign,
  Images,
  CircleAlert,
  PanelBottom,
  Menu,
  Share2,
  ChevronsRight,
  ChevronsDownUp,
  AppWindow,
  PanelsTopLeft,
  SquareMenu,
  Box,
  PanelLeft,
  PanelRight,
  Sparkles,
  Loader2,
  // ---- Publicación (docs/36) -------------------------------------------
  Rocket,
  ExternalLink,
  Trash2,
  // ---- Alineación / dirección (docs/39, Inspector modo simple) ----------
  ArrowRight,
  // ---- Lados de padding/margin (docs/41 §4.4 `SidesGrid`, Paso 3) -------
  ArrowLeft,
  // ---- Candado de "vincular lados" (docs/41 §4.4 D8, fix candado/token) -
  Lock,
  LockOpen,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalSpaceBetween,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  StretchVertical,
  // ---- Dirección de flex / display del layout (Inspector, panel unificado,
  // docs/41, fase 1 simplificación) — iconos descriptivos que sustituyen la
  // flecha genérica rotada de `DirectionIcon` y el `<select>` de texto de
  // `display`. ---------------------------------------------------------
  Rows3,
  Columns3,
  Grid3x3,
  StretchHorizontal,
} from "lucide-react";
