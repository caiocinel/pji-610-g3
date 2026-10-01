// Kit de interface da Velas Luamme. Importe sempre daqui: import { Button, Card } from "@/components/ui";
// (flashToast é só de servidor: import { flashToast } from "@/components/ui/flash-server")

export { cn } from "./cn";
export { montarHref, paraURLSearchParams, param, paginaAtual } from "./url";
export type { ParamsBusca, AlteracoesParams } from "./url";

export { Button, ButtonLink, IconButton, IconLink, Spinner, classesBotao } from "./button";
export type { ButtonProps, ButtonLinkProps, IconButtonProps, IconLinkProps, VarianteBotao, TamanhoBotao, OpcoesBotao } from "./button";
export { SubmitButton } from "./submit-button";
export type { SubmitButtonProps } from "./submit-button";

export { Field, Input, Textarea, Select, Checkbox, erroCampo, descritoPor, idDica, idErro } from "./campos";
export type { FieldProps, InputProps, TextareaProps, SelectProps, OpcaoSelect, CheckboxProps } from "./campos";
export { MoneyInput } from "./money-input";
export type { MoneyInputProps } from "./money-input";
export { NumberStepper } from "./number-stepper";
export type { NumberStepperProps } from "./number-stepper";
export { SearchInput } from "./search-input";
export type { SearchInputProps } from "./search-input";
export { SegmentedControl } from "./segmented-control";
export type { SegmentedControlProps, OpcaoSegmento } from "./segmented-control";
export { PeriodoSelect } from "./periodo-select";
export type { PeriodoSelectProps } from "./periodo-select";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, ListaDetalhes } from "./card";
export type { CardProps, CardHeaderProps } from "./card";
export { StatCard, StatGrid, Variacao, calcularVariacao } from "./stat-card";
export type { StatCardProps } from "./stat-card";
export { Badge, EstoqueBadge, estadoEstoque, ROTULO_ESTADO_ESTOQUE } from "./badge";
export type { BadgeProps, TomBadge, EstadoEstoque } from "./badge";
export { PageHeader, SectionHeader, Breadcrumb } from "./page-header";
export type { PageHeaderProps, ItemTrilha } from "./page-header";
export {
  EmptyState,
  Vazio,
  Aviso,
  Skeleton,
  SkeletonText,
  SkeletonStatCards,
  SkeletonTabela,
  SkeletonPagina,
  Kbd,
  Avatar,
  iniciais,
  ProgressBar,
  EstoqueProgress,
} from "./feedback";
export type { EmptyStateProps, AvisoProps, TipoAviso, ProgressBarProps } from "./feedback";

export { Table, TableScroll, THead, TBody, TFoot, TR, TH, TD, DataTable } from "./table";
export type { Coluna, DataTableProps, PapelMobile } from "./table";
export { Pagination, paginasVisiveis } from "./pagination";
export type { PaginationProps } from "./pagination";
export { TabsLinks, SegmentedLinks } from "./tabs";
export type { ItemAba } from "./tabs";
export { FilterBar, FiltrosAtivos } from "./filter-bar";
export type { FilterBarProps, FiltroAtivo } from "./filter-bar";

export { Dialog, ConfirmDialog, Drawer } from "./dialog";
export type { DialogProps, ConfirmDialogProps, DrawerProps } from "./dialog";
export { Dropdown } from "./dropdown";
export type { DropdownProps, ItemMenu } from "./dropdown";
export { Tooltip } from "./tooltip";
export { Toaster, toast, mostrarToastResultado, useToastAcao } from "./toast";
export type { RetornoAcao, OpcoesToastAcao } from "./toast";
