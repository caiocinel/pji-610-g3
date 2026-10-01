"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Boxes, Check, Phone, Receipt, RotateCcw, Store } from "lucide-react";
import {
  Aviso,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  NumberStepper,
  Textarea,
  erroCampo,
  mostrarToastResultado,
} from "@/components/ui";
import { normalizarInstagram, normalizarTelefone, telefoneValido, type Configuracoes, type EstadoAcao } from "@/lib/dominio";
import { salvarConfiguracoes } from "@/lib/dominio/acoes/configuracoes";
import { formatBRL, formatTelefone } from "@/lib/format";
import { useProtecaoSaida } from "@/components/protecao-saida";
import { chamarAcao } from "@/lib/dominio/resultado";

type Valores = {
  loja_nome: string;
  loja_telefone: string;
  loja_instagram: string;
  loja_endereco: string;
  recibo_rodape: string;
  estoque_minimo_padrao: number;
};

function paraValores(c: Configuracoes): Valores {
  return { ...c, loja_telefone: formatTelefone(c.loja_telefone) };
}

/** Compara como o servidor vai gravar (telefone só dígitos, Instagram sem @). */
function mesmosDados(v: Valores, c: Configuracoes) {
  return (
    v.loja_nome.trim() === c.loja_nome &&
    normalizarTelefone(v.loja_telefone) === c.loja_telefone &&
    normalizarInstagram(v.loja_instagram) === c.loja_instagram &&
    v.loja_endereco.trim() === c.loja_endereco &&
    v.recibo_rodape.trim() === c.recibo_rodape &&
    v.estoque_minimo_padrao === c.estoque_minimo_padrao
  );
}

export function ConfiguracoesForm({ config }: { config: Configuracoes }) {
  const [valores, setValores] = useState<Valores>(() => paraValores(config));
  const [estado, setEstado] = useState<EstadoAcao>(null);
  const [pendente, startTransition] = useTransition();
  const [telefoneTocado, setTelefoneTocado] = useState(false);
  const alterado = !mesmosDados(valores, config);

  // Pede confirmação antes de trocar de tela (menu, abas) ou fechar a aba com alterações não salvas.
  const { dialogo: dialogoSaida } = useProtecaoSaida(alterado && !pendente, {
    titulo: "Sair sem salvar?",
    descricao: "Você alterou as configurações e ainda não salvou. Se sair agora, as mudanças se perdem.",
  });

  function mudar<K extends keyof Valores>(campo: K, valor: Valores[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await chamarAcao(salvarConfiguracoes(fd));
      setEstado(r);
      mostrarToastResultado(r);
      if (r.ok) {
        // Mostra os dados como ficaram gravados (telefone formatado, Instagram sem @).
        setValores((v) => ({
          ...v,
          loja_nome: v.loja_nome.trim(),
          loja_telefone: formatTelefone(normalizarTelefone(v.loja_telefone)),
          loja_instagram: normalizarInstagram(v.loja_instagram),
          loja_endereco: v.loja_endereco.trim(),
          recibo_rodape: v.recibo_rodape.trim(),
        }));
      }
    });
  }

  const erroTelefone =
    erroCampo(estado, "loja_telefone") ??
    (telefoneTocado && !telefoneValido(valores.loja_telefone) ? "Telefone inválido: informe DDD + número." : undefined);

  return (
    <form onSubmit={enviar} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]" noValidate>
      <div className="min-w-0 space-y-6">
        <Card id="loja" className="scroll-mt-24">
          <CardHeader
            icone={<Store />}
            titulo="Dados da loja"
            descricao="Aparecem no cabeçalho do recibo que você imprime ou envia para a cliente."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="loja_nome"
              label="Nome da loja"
              required
              maxLength={80}
              autoComplete="organization"
              value={valores.loja_nome}
              onChange={(e) => mudar("loja_nome", e.target.value)}
              erro={erroCampo(estado, "loja_nome")}
              wrapperClassName="sm:col-span-2"
            />
            <Input
              name="loja_telefone"
              label="Telefone / WhatsApp"
              opcional
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="(11) 98765-4321"
              icone={<Phone />}
              maxLength={30}
              value={valores.loja_telefone}
              onChange={(e) => {
                setTelefoneTocado(false);
                mudar("loja_telefone", e.target.value);
              }}
              onBlur={(e) => {
                setTelefoneTocado(true);
                if (telefoneValido(e.target.value)) mudar("loja_telefone", formatTelefone(normalizarTelefone(e.target.value)));
              }}
              erro={erroTelefone}
              hint="Com DDD. Vira link de WhatsApp no recibo."
            />
            <Input
              name="loja_instagram"
              label="Instagram"
              opcional
              prefixo="@"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="velasluamme"
              maxLength={60}
              value={valores.loja_instagram}
              onChange={(e) => mudar("loja_instagram", e.target.value.replace(/^@+/, ""))}
              onBlur={(e) => mudar("loja_instagram", normalizarInstagram(e.target.value))}
              erro={erroCampo(estado, "loja_instagram")}
              hint="Pode colar o link do perfil."
            />
            <Input
              name="loja_endereco"
              label="Endereço ou cidade"
              opcional
              maxLength={200}
              autoComplete="street-address"
              placeholder="Ex.: Rua das Flores, 123 · Campinas/SP"
              value={valores.loja_endereco}
              onChange={(e) => mudar("loja_endereco", e.target.value)}
              erro={erroCampo(estado, "loja_endereco")}
              wrapperClassName="sm:col-span-2"
            />
            <Textarea
              name="recibo_rodape"
              label="Mensagem no fim do recibo"
              opcional
              rows={2}
              maxLength={300}
              placeholder="Ex.: Obrigada pela preferência! Acenda com carinho."
              value={valores.recibo_rodape}
              onChange={(e) => mudar("recibo_rodape", e.target.value)}
              erro={erroCampo(estado, "recibo_rodape")}
              hint={`${valores.recibo_rodape.length}/300 caracteres`}
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>

        <Card id="estoque" className="scroll-mt-24">
          <CardHeader
            icone={<Boxes />}
            titulo="Estoque"
            descricao="Padrão usado quando você cadastra uma vela nova."
          />
          <NumberStepper
            name="estoque_minimo_padrao"
            label="Estoque mínimo padrão"
            min={0}
            max={100000}
            sufixo="un."
            value={valores.estoque_minimo_padrao}
            onValueChange={(n) => mudar("estoque_minimo_padrao", n)}
            erro={erroCampo(estado, "estoque_minimo_padrao")}
            hint="Quando o estoque de uma vela chega nesse número, ela aparece como “estoque baixo”. As velas já cadastradas não mudam: ajuste cada uma na edição do produto."
            wrapperClassName="max-w-xs"
          />
        </Card>

        {estado?.ok === false && !estado.campos && <Aviso tipo="erro">{estado.erro}</Aviso>}

        <div className="z-10 flex flex-col-reverse gap-2 rounded-xl border border-linha bg-papel/95 p-3 shadow-suave backdrop-blur sm:flex-row sm:items-center sm:justify-between md:sticky md:bottom-4 md:shadow-elevado">
          <p className="flex items-center gap-2 text-sm text-suave" aria-live="polite">
            {alterado ? (
              <Badge tom="mel" ponto>
                Alterações não salvas
              </Badge>
            ) : (
              <>
                <Check aria-hidden className="size-4 text-salvia" />
                Tudo salvo
              </>
            )}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {alterado && (
              <Button
                variante="fantasma"
                icone={<RotateCcw />}
                onClick={() => {
                  setValores(paraValores(config));
                  setEstado(null);
                  setTelefoneTocado(false);
                }}
                disabled={pendente}
              >
                Desfazer
              </Button>
            )}
            <Button type="submit" carregando={pendente} textoCarregando="Salvando…" disabled={!alterado && !pendente}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </div>

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-labelledby="previa-recibo">
        <PreviaRecibo valores={valores} />
      </aside>
      {dialogoSaida}
    </form>
  );
}

/** Miniatura do recibo com os dados digitados (atualiza ao vivo). */
function PreviaRecibo({ valores }: { valores: Valores }) {
  const telefone = normalizarTelefone(valores.loja_telefone);
  const instagram = normalizarInstagram(valores.loja_instagram);
  const contato = [telefone ? formatTelefone(telefone) : "", instagram ? `@${instagram}` : ""].filter(Boolean);
  const exemplo = [
    { nome: "Vela Lavanda & Alecrim", qtd: 2, preco: 39.9 },
    { nome: "Vela Baunilha", qtd: 1, preco: 34.9 },
  ];
  const total = exemplo.reduce((s, i) => s + i.qtd * i.preco, 0);

  return (
    <div>
      <h2 id="previa-recibo" className="mb-3 flex items-center gap-2 text-sm font-semibold text-suave">
        <Receipt aria-hidden className="size-4" />
        Prévia do recibo
      </h2>
      <div className="rounded-xl border border-dashed border-linha-forte bg-papel p-5 text-sm shadow-suave">
        <div className="text-center">
          <p className="font-serif text-xl font-semibold break-words">{valores.loja_nome.trim() || "Nome da loja"}</p>
          {valores.loja_endereco.trim() && <p className="mt-1 text-xs text-suave break-words">{valores.loja_endereco.trim()}</p>}
          {contato.length > 0 && <p className="mt-0.5 text-xs text-suave break-words">{contato.join(" · ")}</p>}
        </div>
        <div className="my-4 border-t border-dashed border-linha-forte" />
        <p className="flex justify-between text-xs text-suave">
          <span>Venda #128</span>
          <span>Hoje, 14:30</span>
        </p>
        <ul className="mt-3 space-y-1.5">
          {exemplo.map((i) => (
            <li key={i.nome} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {i.qtd}× {i.nome}
              </span>
              <span className="tabular shrink-0">{formatBRL(i.qtd * i.preco)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-linha pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular">{formatBRL(total)}</span>
        </p>
        {valores.recibo_rodape.trim() && (
          <p className="mt-4 text-center font-serif text-sm text-suave italic break-words">{valores.recibo_rodape.trim()}</p>
        )}
      </div>
      <p className="mt-2 text-xs text-suave">Exemplo ilustrativo. O recibo real mostra os itens de cada venda.</p>
    </div>
  );
}
