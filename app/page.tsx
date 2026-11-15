import type { Metadata } from "next";
import "./inicio.css";

export const metadata: Metadata = {
  title: "Scrull AI — Seu Instagram no automático",
  description:
    "O Scrull AI cria os posts do seu negócio, agenda nos melhores horários e publica todos os dias. Crie sua primeira semana de posts grátis.",
};

const CADASTRO = "/login?aba=cadastro";

const PASSOS = [
  ["1", "Conte sobre o seu negócio", "Em 2 minutos você responde o que vende e para quem. É assim que a Scrull aprende o jeito da sua marca."],
  ["2", "A IA cria a sua semana", "Arte, legenda e hashtags de cada post, com temas diferentes a cada dia. Sem você enviar foto nenhuma."],
  ["3", "O post sai sozinho", "Conecte o Instagram uma vez e a Scrull publica todos os dias no melhor horário. Você aprova antes, ou deixa no automático."],
];

const DORES = [
  "Sabe que precisa postar, mas o dia acaba e o Instagram ficou para depois",
  "Abre o celular e não tem ideia do que postar hoje",
  "Não quer parar o atendimento para tirar foto e escrever legenda",
  "Posta uma semana, some duas, e o cliente esquece de você",
];

const DUVIDAS = [
  ["Preciso entender de tecnologia?", "Não. Você responde algumas perguntas sobre o seu negócio e conecta o Instagram com um clique. O resto é com a Scrull."],
  ["Preciso mandar fotos?", "Não. A Scrull cria a arte de cada post sozinha, com as cores e o nome da sua marca. Se quiser enviar a sua logo, ela entra em todas as artes."],
  ["E se eu não gostar de um post?", "Você escolhe: pode aprovar cada post antes de ir ao ar, editar a legenda ou pedir outra arte. Quem prefere não ter trabalho nenhum deixa tudo no automático."],
  ["Tem fidelidade?", "Não. A assinatura é mensal e você cancela quando quiser."],
  ["Como eu pago?", "Pelo cartão de crédito, com cobrança mensal automática pelo Mercado Pago. É seguro e o Scrull não vê os dados do seu cartão."],
  ["A demonstração é grátis mesmo?", "É. Você cria a sua primeira semana de posts sem pagar nada. Só assina se quiser que a Scrull publique para você."],
];

export default function Inicio() {
  return (
    <div className="lp">
      <header className="lp-topo">
        <div className="lp-logo">SCRULL<i>AI</i></div>
        <nav>
          <a href="/login" className="lp-link">Entrar</a>
          <a href={CADASTRO} className="lp-btn sm">Testar grátis</a>
        </nav>
      </header>

      <section className="lp-hero">
        <p className="lp-selo">Para pequenos negócios</p>
        <h1>Seu Instagram no automático.</h1>
        <p className="lp-sub">
          A Scrull AI cria os posts do seu negócio, agenda nos melhores horários e publica todos os dias.
          Você aparece, é lembrado e segue cuidando do que importa.
        </p>
        <a href={CADASTRO} className="lp-btn">Criar minha semana de posts grátis</a>
        <p className="lp-mini">Demonstração grátis. Leva 2 minutos.</p>
      </section>

      <section className="lp-sec">
        <h2>Se identificou com alguma dessas?</h2>
        <ul className="lp-dores">
          {DORES.map((d) => <li key={d}>{d}</li>)}
        </ul>
        <p className="lp-fecho">A Scrull foi feita para tirar isso das suas costas.</p>
      </section>

      <section className="lp-sec">
        <h2>Como funciona</h2>
        <div className="lp-passos">
          {PASSOS.map(([n, t, d]) => (
            <div className="lp-passo" key={n}>
              <span className="lp-num">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec" id="planos">
        <h2>Planos</h2>
        <p className="lp-sub2">Comece pela demonstração grátis. Assine só se quiser a Scrull postando por você.</p>
        <div className="lp-planos">
          <div className="lp-plano">
            <span className="lp-tag cinza">Para começar</span>
            <h3>Essencial</h3>
            <p className="lp-preco"><b>R$ 99,90</b><small>/mês</small></p>
            <ul>
              <li>4 posts por semana no feed</li>
              <li>Arte, legenda e hashtags criadas pela IA</li>
              <li>Publicação automática no melhor horário</li>
              <li>Você aprova antes, ou deixa no automático</li>
              <li>Sem fidelidade: cancele quando quiser</li>
            </ul>
            <a href={CADASTRO} className="lp-btn contorno">Começar pela demonstração grátis</a>
          </div>
          <div className="lp-plano destaque">
            <span className="lp-tag">Preço de lançamento</span>
            <h3>Scrull</h3>
            <p className="lp-preco"><s>R$ 199,90</s><b>R$ 129,90</b><small>/mês</small></p>
            <ul>
              <li>1 post por dia no feed, todos os dias</li>
              <li>Arte, legenda e hashtags criadas pela IA</li>
              <li>Publicação automática no melhor horário</li>
              <li>Você aprova antes, ou deixa no automático</li>
              <li>Sem fidelidade: cancele quando quiser</li>
            </ul>
            <a href={CADASTRO} className="lp-btn">Começar pela demonstração grátis</a>
          </div>
          <div className="lp-plano">
            <span className="lp-tag cinza">Em breve</span>
            <h3>Premium</h3>
            <p className="lp-preco"><b>R$ 299,00</b><small>/mês</small></p>
            <ul>
              <li>Tudo do plano Scrull</li>
              <li>Stories</li>
              <li>Reels</li>
            </ul>
            <span className="lp-btn desligado">Disponível em breve</span>
          </div>
        </div>
      </section>

      <section className="lp-sec">
        <h2>Dúvidas comuns</h2>
        <div className="lp-faq">
          {DUVIDAS.map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-final">
        <h2>Veja a sua primeira semana de posts pronta em minutos.</h2>
        <a href={CADASTRO} className="lp-btn claro">Criar minha semana grátis</a>
      </section>

      <footer className="lp-rodape">
        <span>© {new Date().getFullYear()} Scrull AI</span>
        <a href="/termos">Termos de uso</a>
        <a href="/privacidade">Privacidade</a>
      </footer>
    </div>
  );
}
