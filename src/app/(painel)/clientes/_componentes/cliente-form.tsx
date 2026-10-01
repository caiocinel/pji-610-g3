"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Mail, NotebookPen, Phone, UserPlus, UserRound } from "lucide-react";
import {
  Aviso,
  ButtonLink,
  Card,
  CardHeader,
  Input,
  SubmitButton,
  Textarea,
  erroCampo,
  useToastAcao,
} from "@/components/ui";
import {
  criarClienteSchema,
  normalizarInstagram,
  normalizarTelefone,
  telefoneValido,
  type Cliente,
  type EstadoAcao,
  type ResultadoAcao,
} from "@/lib/dominio";
import { criarCliente, editarCliente } from "@/lib/dominio/acoes/clientes";
import { verificarTelefone } from "./verificar-telefone";

type Valores = { nome: string; telefone: string; email: string; instagram: string; observacoes: string };
type Campo = keyof Valores;
const ORDEM_CAMPOS: Campo[] = ["nome", "telefone", "email", "instagram", "observacoes"];
const LIMITE_OBS = 1000;

/** Máscara progressiva: "11987654321" → "(11) 98765-4321"; fixo com 10 dígitos → "(11) 3333-4444". */
export function mascaraTelefone(valor: string): string {
  let d = valor.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

function valoresIniciais(c?: Partial<Cliente>): Valores {
  return {
    nome: c?.nome ?? "",
    telefone: mascaraTelefone(c?.telefone ?? ""),
    email: c?.email ?? "",
    instagram: c?.instagram ?? "",
    observacoes: c?.observacoes ?? "",
  };
}

type Duplicado = { id: number; nome: string; ativo: boolean } | null;

/** `inicial`: pré-preenche um cadastro novo (ex.: vindo de uma busca sem resultado). */
export function ClienteForm({ cliente, inicial }: { cliente?: Cliente; inicial?: Partial<Cliente> }) {
  const editando = !!cliente;
  const router = useRouter();
  const [estado, acao, enviando] = useActionState(
    (_anterior: EstadoAcao<unknown>, fd: FormData): Promise<ResultadoAcao<unknown>> =>
      editando ? editarCliente(fd) : criarCliente(fd),
    null,
  );
  useToastAcao(estado);

  // Campos controlados: o React 19 limpa o formulário após a action, e queremos manter o que foi digitado em caso de erro.
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(cliente ?? inicial));
  const [errosLocais, setErrosLocais] = useState<Partial<Record<Campo, string>>>({});
  const [duplicado, setDuplicado] = useState<Duplicado>(null);
  const [, iniciarVerificacao] = useTransition();
  const ultimoVerificado = useRef(normalizarTelefone(cliente?.telefone ?? ""));
  const formRef = useRef<HTMLFormElement>(null);

  const alterado = ORDEM_CAMPOS.some((c) => valores[c] !== valoresIniciais(cliente ?? inicial)[c]);

  // Depois de salvar, vai para a ficha do cliente.
  useEffect(() => {
    if (estado?.ok) {
      const id = estado.id ?? cliente?.id;
      router.push(id ? `/clientes/${id}` : "/clientes");
    } else if (estado?.campos) {
      focarPrimeiroErro(estado.campos);
    }
  }, [estado, router, cliente?.id]);

  // Avisa se sair da página com alterações não salvas (recarregar/fechar aba).
  useEffect(() => {
    if (!alterado || estado?.ok) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado, estado?.ok]);

  function focarPrimeiroErro(campos: Partial<Record<string, string>>) {
    const primeiro = ORDEM_CAMPOS.find((c) => campos[c]);
    if (primeiro) formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
  }

  function alterar(campo: Campo, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    if (errosLocais[campo]) setErrosLocais((e) => ({ ...e, [campo]: undefined }));
  }

  function alterarTelefone(bruto: string) {
    const anterior = valores.telefone;
    // Apagando um caractere da máscara ("-", ")"), apaga também o dígito anterior.
    const digitosAntes = anterior.replace(/\D/g, "");
    let digitos = bruto.replace(/\D/g, "");
    if (bruto.length < anterior.length && digitos === digitosAntes) digitos = digitos.slice(0, -1);
    alterar("telefone", mascaraTelefone(digitos));
    if (duplicado && normalizarTelefone(digitos) !== ultimoVerificado.current) setDuplicado(null);
  }

  function verificarDuplicado() {
    const digitos = normalizarTelefone(valores.telefone);
    if (!digitos) {
      setDuplicado(null);
      return;
    }
    if (!telefoneValido(digitos)) {
      setErrosLocais((e) => ({ ...e, telefone: "Telefone inválido: informe DDD + número (ex.: 11 98765-4321)." }));
      return;
    }
    if (digitos === ultimoVerificado.current) return;
    ultimoVerificado.current = digitos;
    iniciarVerificacao(async () => {
      setDuplicado(await verificarTelefone(digitos, cliente?.id));
    });
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    const r = criarClienteSchema.safeParse(valores);
    if (r.success) {
      setErrosLocais({});
      return;
    }
    e.preventDefault();
    const erros: Partial<Record<Campo, string>> = {};
    for (const issue of r.error.issues) {
      const campo = issue.path[0] as Campo;
      erros[campo] ??= issue.message;
    }
    setErrosLocais(erros);
    focarPrimeiroErro(erros);
  }

  const erro = (campo: Campo) => errosLocais[campo] ?? erroCampo(estado, campo);
  const erroGeral = estado?.ok === false && !estado.campos ? estado.erro : null;
  const instagramLimpo = normalizarInstagram(valores.instagram);
  const voltarHref = cliente ? `/clientes/${cliente.id}` : "/clientes";

  return (
    <form ref={formRef} action={acao} onSubmit={aoEnviar} noValidate className="max-w-3xl space-y-6">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <Card>
        <CardHeader
          titulo="Dados do cliente"
          descricao="Só o nome é obrigatório. O telefone permite chamar no WhatsApp com um toque."
          icone={<UserRound />}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            name="nome"
            label="Nome"
            required
            maxLength={120}
            autoComplete="off"
            autoCapitalize="words"
            autoFocus={!editando}
            placeholder="Ex.: Maria Souza"
            value={valores.nome}
            onChange={(e) => alterar("nome", e.target.value)}
            erro={erro("nome")}
            wrapperClassName="sm:col-span-2"
          />
          <div className="space-y-2">
            <Input
              name="telefone"
              label="Telefone / WhatsApp"
              opcional
              type="tel"
              inputMode="tel"
              autoComplete="off"
              icone={<Phone />}
              placeholder="(11) 98765-4321"
              value={valores.telefone}
              onChange={(e) => alterarTelefone(e.target.value)}
              onBlur={verificarDuplicado}
              erro={erro("telefone")}
              hint="Com DDD."
            />
            {duplicado && (
              <Aviso tipo="atencao" className="text-xs">
                Esse telefone já está no cadastro de{" "}
                <Link href={`/clientes/${duplicado.id}`} className="font-semibold underline" target="_blank">
                  {duplicado.nome}
                </Link>
                {duplicado.ativo ? "" : " (desativado)"}. Confira para não duplicar.
              </Aviso>
            )}
          </div>
          <Input
            name="email"
            label="E-mail"
            opcional
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            icone={<Mail />}
            placeholder="maria@email.com"
            maxLength={160}
            value={valores.email}
            onChange={(e) => alterar("email", e.target.value)}
            erro={erro("email")}
          />
          <Input
            name="instagram"
            label="Instagram"
            opcional
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            icone={<AtSign />}
            placeholder="usuario"
            maxLength={60}
            value={valores.instagram}
            onChange={(e) => alterar("instagram", e.target.value)}
            erro={erro("instagram")}
            hint={
              instagramLimpo && instagramLimpo !== valores.instagram.trim()
                ? `Será salvo como @${instagramLimpo}`
                : "Pode colar o link do perfil."
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          titulo="Anotações"
          descricao="Preferências, aniversário, aromas que não gosta… só você vê."
          icone={<NotebookPen />}
        />
        <Textarea
          name="observacoes"
          label="Observações"
          labelOculto
          rows={4}
          maxLength={LIMITE_OBS}
          placeholder="Ex.: prefere aromas cítricos; aniversário em 12/03."
          value={valores.observacoes}
          onChange={(e) => alterar("observacoes", e.target.value)}
          erro={erro("observacoes")}
          hint={`${valores.observacoes.length}/${LIMITE_OBS} caracteres`}
        />
      </Card>

      {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href={voltarHref} variante="secundario" desabilitado={enviando}>
          Cancelar
        </ButtonLink>
        <SubmitButton pendente={editando ? "Salvando…" : "Cadastrando…"} icone={editando ? undefined : <UserPlus />}>
          {editando ? "Salvar alterações" : "Cadastrar cliente"}
        </SubmitButton>
      </div>
    </form>
  );
}
