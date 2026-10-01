"use client";

import { useId, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { AtSign, Phone, Search, UserPlus, UserRound, X } from "lucide-react";
import { Avatar, Button, Dialog, Input, cn, toast } from "@/components/ui";
import { criarCliente } from "@/lib/dominio/acoes/clientes";
import { formatTelefone, plural } from "@/lib/format";
import { combinaBusca, termosBusca, type ClientePDV } from "./tipos";

const MAX_SUGESTOES = 6;

export type SeletorClienteProps = {
  clientes: ClientePDV[];
  cliente: ClientePDV | null;
  onSelecionar: (cliente: ClientePDV | null) => void;
};

/** Cliente opcional da venda: busca (nome, telefone, Instagram, e-mail) + cadastro rápido sem sair do PDV. */
export function SeletorCliente({ clientes, cliente, onSelecionar }: SeletorClienteProps) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [cadastro, setCadastro] = useState(false);
  const idLista = useId();

  if (cliente) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-linha-forte bg-papel px-3 py-2 shadow-suave">
        <Avatar nome={cliente.nome} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-tinta">{cliente.nome}</p>
          <p className="truncate text-xs text-suave">
            {[cliente.telefone && formatTelefone(cliente.telefone), cliente.compras ? plural(cliente.compras, "compra") : "Primeira compra"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelecionar(null);
            requestAnimationFrame(() => document.getElementById("pdv-cliente")?.focus());
          }}
          aria-label={`Remover cliente ${cliente.nome} da venda`}
          title="Trocar cliente"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-suave transition hover:bg-areia hover:text-tinta sm:size-8"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  const termos = termosBusca(texto);
  const digitos = texto.replace(/\D/g, "");
  const sugestoes =
    termos.length === 0
      ? clientes.slice(0, MAX_SUGESTOES) // recentes
      : clientes
          .filter(
            (c) =>
              combinaBusca(termos, c.nome, c.email, c.instagram, c.telefone, formatTelefone(c.telefone)) ||
              (digitos.length >= 3 && c.telefone.includes(digitos)),
          )
          .slice(0, MAX_SUGESTOES);
  // Última opção: cadastrar com o texto digitado.
  const total = sugestoes.length + 1;
  const indiceAtivo = Math.min(ativo, total - 1);

  function escolher(c: ClientePDV) {
    onSelecionar(c);
    setTexto("");
    setAberto(false);
  }

  function abrirCadastro() {
    setAberto(false);
    setCadastro(true);
  }

  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAberto(true);
      setAtivo((indiceAtivo + (e.key === "ArrowDown" ? 1 : -1) + total) % total);
    } else if (e.key === "Enter" && aberto && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      if (indiceAtivo < sugestoes.length) escolher(sugestoes[indiceAtivo]);
      else abrirCadastro();
    } else if (e.key === "Escape" && aberto) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
    }
  }

  const idOpcao = (i: number) => `${idLista}-op-${i}`;

  return (
    <div className="relative">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" />
        <input
          id="pdv-cliente"
          type="text"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={aberto ? idOpcao(indiceAtivo) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={texto}
          placeholder="Buscar por nome ou telefone…"
          onChange={(e) => {
            setTexto(e.currentTarget.value);
            setAtivo(0);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onClick={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={teclado}
          className="campo pl-9"
        />
      </div>

      {aberto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Clientes"
          // Evita perder o foco do campo ao clicar numa opção.
          onMouseDown={(e) => e.preventDefault()}
          className="animate-entrada absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-linha bg-papel p-1 shadow-elevado rolagem-fina"
        >
          {termos.length === 0 && sugestoes.length > 0 && (
            <li role="presentation" className="px-2.5 pt-1.5 pb-1 text-xs font-medium tracking-wide text-suave uppercase">
              Clientes recentes
            </li>
          )}
          {termos.length > 0 && sugestoes.length === 0 && (
            <li role="presentation" className="px-2.5 py-2 text-sm text-suave">
              Nenhum cliente encontrado.
            </li>
          )}
          {sugestoes.map((c, i) => (
            <li
              key={c.id}
              id={idOpcao(i)}
              role="option"
              aria-selected={i === indiceAtivo}
              onClick={() => escolher(c)}
              onMouseEnter={() => setAtivo(i)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5",
                i === indiceAtivo && "bg-areia",
              )}
            >
              <Avatar nome={c.nome} tamanho="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-tinta">{c.nome}</span>
                <span className="block truncate text-xs text-suave">
                  {[c.telefone && formatTelefone(c.telefone), c.instagram && `@${c.instagram}`].filter(Boolean).join(" · ") ||
                    "Sem contato"}
                </span>
              </span>
              {c.compras > 0 && <span className="tabular shrink-0 text-xs text-suave">{plural(c.compras, "compra")}</span>}
            </li>
          ))}
          <li
            id={idOpcao(sugestoes.length)}
            role="option"
            aria-selected={indiceAtivo === sugestoes.length}
            onClick={abrirCadastro}
            onMouseEnter={() => setAtivo(sugestoes.length)}
            className={cn(
              "mt-0.5 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-t border-linha px-2.5 py-1.5 text-sm font-medium text-chama-escura",
              indiceAtivo === sugestoes.length && "bg-chama-clara",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chama-clara">
              <UserPlus aria-hidden className="size-4" />
            </span>
            <span className="truncate">{texto.trim() ? `Cadastrar “${texto.trim()}”` : "Cadastrar cliente novo"}</span>
          </li>
        </ul>
      )}

      <CadastroRapido
        aberto={cadastro}
        textoInicial={texto.trim()}
        onFechar={() => setCadastro(false)}
        onCriado={(c) => {
          setCadastro(false);
          escolher(c);
        }}
      />
    </div>
  );
}

/** Diálogo de cadastro rápido de cliente (nome + telefone + Instagram). */
function CadastroRapido({
  aberto,
  textoInicial,
  onFechar,
  onCriado,
}: {
  aberto: boolean;
  textoInicial: string;
  onFechar: () => void;
  onCriado: (c: ClientePDV) => void;
}) {
  const [pendente, startTransition] = useTransition();
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  // Se digitou só números, provavelmente é o telefone.
  const pareceTelefone = /^[\d\s()+-]{8,}$/.test(textoInicial);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof criarCliente>>;
      try {
        r = await criarCliente(fd);
      } catch {
        // Falha de rede/servidor: sem isso o erro iria para o error.tsx e o PDV inteiro sumiria.
        setErroGeral("Sem conexão com o servidor. Confira a internet e tente de novo.");
        return;
      }
      if (r.ok && r.dados) {
        setErros({});
        setErroGeral(null);
        toast.success(r.mensagem);
        onCriado({ ...r.dados, instagram: String(fd.get("instagram") ?? "").replace(/^@/, ""), email: "", compras: 0 });
      } else {
        setErros(r.campos ?? {});
        setErroGeral(r.campos ? null : (r.erro ?? "Não foi possível cadastrar agora."));
      }
    });
  }

  return (
    <Dialog
      aberto={aberto}
      bloqueado={pendente}
      onFechar={() => {
        if (pendente) return;
        setErros({});
        setErroGeral(null);
        onFechar();
      }}
      titulo="Cadastro rápido de cliente"
      descricao="Só o nome é obrigatório. Os outros dados você completa depois em Clientes."
      tamanho="sm"
      icone={
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-chama-clara text-chama-escura">
          <UserRound aria-hidden className="size-5" />
        </span>
      }
    >
      <form onSubmit={enviar} className="space-y-4 pb-5 sm:pb-6" noValidate>
        <Input
          id="pdv-novo-cliente-nome"
          name="nome"
          label="Nome"
          required
          maxLength={120}
          autoFocus
          autoComplete="off"
          defaultValue={pareceTelefone ? "" : textoInicial}
          erro={erros.nome}
        />
        <Input
          id="pdv-novo-cliente-telefone"
          name="telefone"
          label="Telefone / WhatsApp"
          opcional
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="(11) 98765-4321"
          icone={<Phone />}
          defaultValue={pareceTelefone ? textoInicial : ""}
          erro={erros.telefone}
        />
        <Input
          id="pdv-novo-cliente-instagram"
          name="instagram"
          label="Instagram"
          opcional
          autoComplete="off"
          autoCapitalize="none"
          placeholder="usuario"
          icone={<AtSign />}
          erro={erros.instagram}
        />
        {erroGeral && (
          <p role="alert" className="text-sm font-medium text-alerta">
            {erroGeral}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variante="secundario" onClick={onFechar} disabled={pendente}>
            Cancelar
          </Button>
          <Button type="submit" icone={<UserPlus />} carregando={pendente} textoCarregando="Cadastrando…">
            Cadastrar e usar na venda
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
