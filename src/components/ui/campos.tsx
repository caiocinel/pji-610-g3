import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "./cn";

/** ids auxiliares usados em aria-describedby. */
export const idDica = (id: string) => `${id}-dica`;
export const idErro = (id: string) => `${id}-erro`;

/** Monta aria-describedby para um campo com dica e/ou erro. */
export function descritoPor(id: string, dica?: ReactNode, erro?: ReactNode): string | undefined {
  const ids = [dica ? idDica(id) : null, erro ? idErro(id) : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/**
 * Lê o erro de um campo a partir do estado de uma Server Action ({ ok:false, campos:{ nome:"…" } }).
 * Ex.: <Input name="nome" erro={erroCampo(estado, "nome")} />
 */
export function erroCampo(estado: unknown, campo: string): string | undefined {
  if (!estado || typeof estado !== "object") return undefined;
  const campos = (estado as { campos?: Record<string, string> }).campos;
  return campos?.[campo];
}

export type FieldProps = {
  /** id do controle dentro do Field (liga o <label>). */
  id: string;
  label?: ReactNode;
  /** Texto de ajuda abaixo do campo. */
  hint?: ReactNode;
  /** Mensagem de erro (deixa o campo vermelho se você também passar aria-invalid no controle). */
  erro?: ReactNode;
  /** Mostra "(opcional)" ao lado do rótulo. */
  opcional?: boolean;
  /** Esconde o rótulo visualmente (continua acessível). */
  labelOculto?: boolean;
  /** Elemento à direita do rótulo (ex.: link "Criar categoria"). */
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Rótulo + controle + dica + erro. Use quando o controle não for um Input/Select/Textarea do kit. */
export function Field({ id, label, hint, erro, opcional, labelOculto, extra, className, children }: FieldProps) {
  return (
    <div className={cn("min-w-0", className)}>
      {(label || extra) && (
        <div className={cn("flex items-baseline justify-between gap-2", labelOculto && "sr-only")}>
          {label && (
            <label htmlFor={id} className="rotulo">
              {label}
              {opcional && <span className="ml-1 font-normal text-suave">(opcional)</span>}
            </label>
          )}
          {extra && <div className="mb-1.5 text-sm">{extra}</div>}
        </div>
      )}
      {children}
      {hint && !erro && (
        <p id={idDica(id)} className="dica">
          {hint}
        </p>
      )}
      {erro && (
        <p id={idErro(id)} className="mt-1.5 flex items-start gap-1 text-xs font-medium text-alerta">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {erro}
        </p>
      )}
    </div>
  );
}

type CampoComum = {
  label?: ReactNode;
  hint?: ReactNode;
  erro?: ReactNode;
  opcional?: boolean;
  labelOculto?: boolean;
  extra?: ReactNode;
  /** Classe do bloco externo (Field). `className` vai no próprio controle. */
  wrapperClassName?: string;
};

export type InputProps = InputHTMLAttributes<HTMLInputElement> &
  CampoComum & {
    /** Ícone dentro do campo, à esquerda. Ex.: icone={<Search />} */
    icone?: ReactNode;
    /** Texto fixo à esquerda (ex.: "R$"). */
    prefixo?: ReactNode;
    /** Texto fixo à direita (ex.: "un.", "%", "g"). */
    sufixo?: ReactNode;
  };

/** Campo de texto. O id padrão é o `name`. Ex.: <Input name="nome" label="Nome da vela" required /> */
export function Input({
  label,
  hint,
  erro,
  opcional,
  labelOculto,
  extra,
  wrapperClassName,
  icone,
  prefixo,
  sufixo,
  className,
  id,
  ...rest
}: InputProps) {
  const campoId = id ?? rest.name ?? "";
  const temAdorno = !!(icone || prefixo || sufixo);
  const controle = (
    <input
      id={campoId || undefined}
      aria-invalid={erro ? true : undefined}
      aria-describedby={campoId ? descritoPor(campoId, hint, erro) : undefined}
      className={cn("campo", (icone || prefixo) && "pl-9", sufixo && "pr-10", className)}
      data-autofocus={rest.autoFocus || undefined}
      {...rest}
    />
  );
  const comAdorno = temAdorno ? (
    <div className="relative">
      {(icone || prefixo) && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-suave [&_svg]:size-4">
          {icone ?? prefixo}
        </span>
      )}
      {controle}
      {sufixo && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-suave">
          {sufixo}
        </span>
      )}
    </div>
  ) : (
    controle
  );
  if (!label && !hint && !erro) return wrapperClassName ? <div className={wrapperClassName}>{comAdorno}</div> : comAdorno;
  return (
    <Field
      id={campoId}
      label={label}
      hint={hint}
      erro={erro}
      opcional={opcional}
      labelOculto={labelOculto}
      extra={extra}
      className={wrapperClassName}
    >
      {comAdorno}
    </Field>
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & CampoComum;

export function Textarea({
  label,
  hint,
  erro,
  opcional,
  labelOculto,
  extra,
  wrapperClassName,
  className,
  id,
  rows = 3,
  ...rest
}: TextareaProps) {
  const campoId = id ?? rest.name ?? "";
  return (
    <Field
      id={campoId}
      label={label}
      hint={hint}
      erro={erro}
      opcional={opcional}
      labelOculto={labelOculto}
      extra={extra}
      className={wrapperClassName}
    >
      <textarea
        id={campoId || undefined}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={campoId ? descritoPor(campoId, hint, erro) : undefined}
        className={cn("campo-area", className)}
        data-autofocus={rest.autoFocus || undefined}
        {...rest}
      />
    </Field>
  );
}

export type OpcaoSelect = { valor: string | number; rotulo: string; desabilitada?: boolean };

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  CampoComum & {
    /** Opções (alternativa a passar <option> como children). */
    opcoes?: OpcaoSelect[];
    /** Primeira opção vazia, ex.: "Todas as categorias" (valor ""). */
    placeholder?: string;
  };

/** Select nativo estilizado (ótimo no celular). */
export function Select({
  label,
  hint,
  erro,
  opcional,
  labelOculto,
  extra,
  wrapperClassName,
  className,
  id,
  opcoes,
  placeholder,
  children,
  ...rest
}: SelectProps) {
  const campoId = id ?? rest.name ?? "";
  return (
    <Field
      id={campoId}
      label={label}
      hint={hint}
      erro={erro}
      opcional={opcional}
      labelOculto={labelOculto}
      extra={extra}
      className={wrapperClassName}
    >
      <div className="relative">
        <select
          id={campoId || undefined}
          aria-invalid={erro ? true : undefined}
          aria-describedby={campoId ? descritoPor(campoId, hint, erro) : undefined}
          className={cn("campo cursor-pointer appearance-none pr-9", className)}
          data-autofocus={rest.autoFocus || undefined}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {opcoes?.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
              {o.rotulo}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-suave" />
      </div>
    </Field>
  );
}

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  descricao?: ReactNode;
};

/** Caixa de seleção com rótulo clicável (área de toque confortável). */
export function Checkbox({ label, descricao, className, id, ...rest }: CheckboxProps) {
  const campoId = id ?? rest.name;
  return (
    <label
      htmlFor={campoId}
      className={cn("flex min-h-10 cursor-pointer items-start gap-3 rounded-lg py-2 text-sm text-tinta", className)}
    >
      <input
        id={campoId}
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-chama"
        {...rest}
      />
      <span>
        <span className="font-medium">{label}</span>
        {descricao && <span className="mt-0.5 block text-xs text-suave">{descricao}</span>}
      </span>
    </label>
  );
}
