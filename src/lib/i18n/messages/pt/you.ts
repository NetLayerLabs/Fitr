import type { NsMessages } from "../types";

const you: Partial<NsMessages<"you">> = {
  languageTitle: "Idioma",
  languageHint: "Muda todas as telas do app",

  // You tab page
  pageTitle: "Você",
  pageDescription: "Sua carteira, status do Seeker, configurações e como o Fitr verifica os treinos e cuida dos seus dados.",
  walletHeading: "Carteira",
  settingsHeading: "Configurações",
  aboutHeading: "Sobre o Fitr",

  // Profile header
  profileLabel: "Perfil",
  changePhoto: "Trocar foto do perfil",
  addPhoto: "Adicionar foto do perfil",
  photoNotImage: "Escolha um arquivo de imagem.",
  photoTooLarge: "Essa imagem é grande demais.",
  namePlaceholder: "Seu nome",
  saveName: "Salvar nome",
  addName: "Adicionar seu nome",
  editName: "Editar nome",
  adjustPhotoTitle: "Ajustar foto",
  photoMenuTitle: "Foto do perfil",
  chooseNewPhoto: "Escolher uma nova foto",
  removePhoto: "Remover foto",
  photoStaysOnDevice: "Sua foto fica neste aparelho. Ela nunca é enviada.",

  // Avatar crop editor
  cropOpenFailed: "Não foi possível abrir essa imagem. Tente um JPEG ou PNG.",
  cropProcessFailed: "Não foi possível processar essa imagem.",
  cropClose: "Fechar",
  cropLoading: "Carregando foto…",
  cropViewportLabel: "Enquadramento da foto. Arraste ou use as setas para mover; faça pinça ou use mais e menos para dar zoom.",
  cropZoom: "Zoom",
  cropHint: "Arraste para posicionar. Faça pinça ou use o controle deslizante para dar zoom.",
  cropCancel: "Cancelar",
  cropSave: "Salvar foto",

  // Settings
  remindersTitle: "Lembretes de treino",
  remindersOff: "Desligado. O Fitr não vai te avisar antes do prazo de um stake.",
  remindersBlocked: "As notificações estão bloqueadas para o Fitr. Toque no botão para abrir as configurações do Android.",
  remindersAllow: "Permita notificações para o Fitr te lembrar antes do seu prazo.",
  remindersOn: "Um aviso 2 horas antes do prazo do seu stake e um último aviso 30 minutos antes.",
  cameraTitle: "Câmera padrão",
  cameraHint: "Com qual câmera o treino abre. Você ainda pode trocar na tela do treino.",
  cameraFront: "Frontal",
  cameraBack: "Traseira",
  hapticsTitle: "Vibração",
  hapticsHint: "Uma vibração curta a cada rep contada e quando você atinge sua meta.",
  voiceCoachTitle: "Treinador de voz",
  voiceCoachHint: "Conta suas reps em voz alta e avisa sobre postura e checagens ao vivo, para você nunca precisar olhar a tela.",
  formGuidesTitle: "Guias de execução",
  formGuidesAllShown: "Cada exercício mostra seu guia de execução antes de você começar.",
  formGuidesHidden_one: "Oculto para {count} exercício.",
  formGuidesHidden_other: "Oculto para {count} exercícios.",
  formGuidesShowAll: "Mostrar todos os guias de execução de novo",

  // About links
  websiteTitle: "Site do Fitr",
  websiteHint: "fitr.day · compartilhe com os amigos",
  opensInBrowser: " (abre no seu navegador)",
  verificationLinkTitle: "Como a verificação funciona",
  verificationLinkHint: "O que o Fitr confere e o que ele não consegue conferir",
  privacyLinkTitle: "Privacidade",
  privacyLinkHint: "Seu vídeo nunca sai do seu celular",
  creditsLinkTitle: "Créditos e licenças",
  creditsLinkHint: "Software de código aberto que usamos",
  appVersion: "Fitr {version}",

  // Verification doc
  verificationEyebrow: "Confiança",
  verificationTitle: "Como a verificação funciona",
  verificationDescription:
    "O que o Fitr confere antes de um dia com stake contar, o que a blockchain garante e no que você precisa confiar.",
  verificationLead:
    "O Fitr foi feito para ser resistente a trapaças, não à prova de trapaças. Veja exatamente o que é conferido, por quem e no que você está confiando.",
  verificationPhoneHeading: "1. Seu celular conta as reps",
  verificationPhoneBody:
    "A IA de pose no aparelho encontra 33 pontos do corpo em cada quadro da câmera e só conta uma rep quando suas articulações fazem a amplitude completa (por exemplo, cotovelos além de 90° na flexão). Reps pela metade aparecem como “não contadas”. Tudo isso roda inteiramente no seu celular.",
  verificationServerHeading: "2. Em treinos com stake, o servidor do Fitr confere de novo",
  verificationServerIntro:
    "Quando há dinheiro em jogo, seu celular também envia os pontos do esqueleto (nunca vídeo) para o servidor de verificação do Fitr enquanto você treina. O servidor:",
  verificationServerRecount:
    "reconta cada rep por conta própria com o mesmo mecanismo de contagem, então nunca confia só na palavra do seu celular;",
  verificationServerChallengesBefore: "te passa ",
  verificationServerChallengesStrong: "desafios ao vivo",
  verificationServerChallengesAfter:
    " em momentos aleatórios, como “levante a mão direita”, que um vídeo pré-gravado não tem como saber de antemão;",
  verificationServerPlausible:
    "confere se o movimento é fisicamente plausível: o comprimento dos ossos se mantém, as articulações não se teletransportam e o ritmo é humano;",
  verificationServerTiming: "confere o tempo com o próprio relógio e rejeita uma sessão que já foi enviada.",
  verificationServerOutro: "Só quando tudo isso passa o servidor marca seu dia como concluído onchain.",
  verificationChainHeading: "3. A blockchain garante as regras do dinheiro",
  verificationChainBody:
    "Seu stake fica em um programa de cofre onchain na Solana, não com o Fitr. O programa garante os prazos, um compromisso por carteira por dia, o cálculo dos pagamentos (seu stake de volta mais uma parte proporcional dos stakes perdidos, menos uma taxa de 5% cobrada apenas sobre os valores perdidos) e que não haja resgates em dobro. O Fitr não consegue transferir seu stake para si mesmo, e se um dia for anulado, todos são reembolsados.",
  verificationTrustHeading: "No que você está confiando",
  verificationTrustBody:
    "A blockchain não consegue ver seu treino, então você confia que o servidor do Fitr vai julgá-lo de forma justa: marcar você como concluído quando você fez o treino e não marcar como concluído ninguém que não fez. Cada decisão leva uma impressão digital da sessão avaliada, para que possa ser auditada.",
  verificationLimitsBody:
    "Nenhum sistema baseado em câmera é impossível de enganar. Um trapaceiro determinado com um app modificado ou um dublê convincente pode conseguir passar. As verificações acima existem para tornar isso difícil, lento e não valer o stake.",

  // Privacy doc
  privacyEyebrow: "Seus dados",
  privacyTitle: "Privacidade",
  privacyDescription: "Seu vídeo nunca sai do seu celular. O que o Fitr armazena, o que ele envia e quando.",
  privacyLeadStrong: "O vídeo da sua câmera nunca sai do seu celular.",
  privacyLeadRest: " Ele é analisado no aparelho, quadro a quadro, e nunca é gravado nem enviado.",
  privacyFreeHeading: "Treinos livres",
  privacyFreeBody:
    "Nada sobre o treino é enviado para lugar nenhum. Seu histórico, sequências, recordes e conquistas ficam salvos só neste app, neste celular. Limpar o histórico na aba Progresso apaga tudo isso.",
  privacyStakedHeading: "Treinos com stake",
  privacyStakedBody:
    "Para verificar um dia com stake, seu celular envia ao servidor de verificação do Fitr os pontos do esqueleto da sessão: as posições de 33 articulações do corpo ao longo do tempo, mais suas respostas aos desafios ao vivo. Sem vídeo, sem imagens, sem áudio. O servidor usa esses dados para conferir suas reps e guarda uma impressão digital da sessão para impedir que o mesmo treino seja enviado duas vezes.",
  privacyWalletHeading: "Sua carteira",
  privacyWalletBody:
    "O Fitr vê o endereço público da sua carteira quando você conecta, para mostrar seu saldo e o status do Seeker. Suas chaves ficam na sua carteira, e cada transação é aprovada por você. Stakes, conclusões e pagamentos são registrados na blockchain da Solana, que é pública.",
  privacyThirdPartiesHeading: "Terceiros",
  privacyThirdPartiesBody:
    "A IA de pose no aparelho (Google MediaPipe) pode enviar ao Google estatísticas de uso anônimas sobre a própria biblioteca. Elas não contêm vídeo, imagens nem pontos do corpo.",
  privacySettingsHeading: "Configurações",
  privacySettingsBody: "Suas preferências de câmera, vibração e guias de execução ficam salvas só neste celular.",

  // Credits doc
  creditsEyebrow: "Obrigado",
  creditsTitle: "Créditos e licenças",
  creditsDescription: "O software de código aberto, as fontes e as mídias usados para construir o Fitr.",
  creditsIntro: "O Fitr é construído com software de código aberto. Obrigado a todos que o criam.",
  creditsClipsHeading: "Vídeos dos guias de execução",
  creditsClipLabel: "Demonstração de {exercise} por {author}",

  // Root layout
  skipToContent: "Pular para o conteúdo",
  appDescription:
    "O Fitr conta suas flexões, agachamentos e pranchas com rastreamento de pose por IA no aparelho. Cada rep é conferida pelos ângulos das articulações, e seu vídeo nunca sai do seu celular.",

  // Android reminders and widget (built outside render)
  nativeReminderTitleGoal: "Faltam {left}: {goal}",
  nativeReminderTitle: "Faltam {left} para treinar",
  nativeReminderBodyStake: "Termine hoje ou seu stake de {stake} vai para quem apareceu.",
  nativeReminderBody: "Termine o treino de hoje antes do prazo.",
};

export default you;
