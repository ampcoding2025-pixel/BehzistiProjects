export type Locale = "en" | "fa";

export const LOCALE_STORAGE_KEY = "behzisti-ui-locale";

export type Messages = {
  nav: {
    launchGuide: string;
    overview: string;
    profile: string;
    skills: string;
    knowledge: string;
    playground: string;
    copilot: string;
    settings: string;
    aiAgent: string;
  };
  knowledge: {
    title: string;
    needsSetup: string;
    ready: string;
    all: string;
    websites: string;
    files: string;
    articles: string;
    faq: string;
    newSource: string;
    addSource: string;
    loading: string;
    emptyTitle: string;
    emptyDesc: string;
    websiteSoon: string;
    circularHint: string;
    lawHint: string;
    faqHint: string;
    refreshSources: string;
    refreshHint: string;
    close: string;
    colName: string;
    colLastUpdated: string;
    colAddedBy: string;
    colActions: string;
    addedBySystem: string;
    viewSource: string;
    removeSource: string;
    noDate: string;
    pagePrev: string;
    pageNext: string;
    pageOf: string;
    rowsPerPage: string;
    addSourceMenu: string;
    addWebsite: string;
    addFile: string;
    addArticle: string;
    addFaq: string;
    addDatabase: string;
    databaseSources: {
      title: string;
      description: string;
      addConnection: string;
      empty: string;
      loading: string;
      name: string;
      endpoint: string;
      endpointHint: string;
      host: string;
      connected: string;
      disconnected: string;
      enabled: string;
      disabled: string;
      enable: string;
      settings: string;
      sync: string;
      syncing: string;
      syncedCases: string;
      lastSync: string;
      neverSynced: string;
      test: string;
      testing: string;
      save: string;
      cancel: string;
      remove: string;
      removeConfirm: string;
      credentials: string;
      credentialsHint: string;
      historicalWarning: string;
      testSuccess: string;
    };
  };
  playground: {
    title: string;
    needsSetup: string;
    ready: string;
    chooseScenario: string;
    chooseScenarioDesc: string;
    suggested: string;
    knowledgeGaps: string;
    noSuggestedTitle: string;
    noSuggestedDesc: string;
    noGapsTitle: string;
    noGapsDesc: string;
    loadingSuggestions: string;
    welcome: string;
    agentName: string;
    writeMessage: string;
    send: string;
    resetChat: string;
    typing: string;
    details: string;
    collapseDetails: string;
    noResponseTitle: string;
    noResponseDesc: string;
    provider: string;
    confidence: string;
    sourcesUsed: string;
    noSourcesMatched: string;
  };
  profile: {
    name: string;
    status: string;
    acceptingChats: string;
    notAcceptingChats: string;
    language: string;
    toneOfVoice: string;
    answerLength: string;
    customVoice: string;
    editName: string;
    acceptChats: string;
    english: string;
    persian: string;
    allLanguages: string;
    friendly: string;
    professional: string;
    casual: string;
    empathetic: string;
    short: string;
    medium: string;
    long: string;
    uiLanguageHint: string;
  };
  overview: {
    knowledgeSources: string;
    inUse: string;
    knowledgeDesc: string;
    manageKnowledge: string;
    skills: string;
    active: string;
    skillsDesc: string;
    browseSkills: string;
    performanceData: string;
    dateRange: string;
    viewFullReport: string;
    metricResolution: string;
    metricChats: string;
    metricCsat: string;
    metricTransferred: string;
    comparePercent: string;
    compareCount: string;
    knowledgeGaps: string;
    noGapsTitle: string;
    noGapsDesc: string;
    gapsPreviewAlt: string;
  };
  skillsPage: {
    customSkills: string;
    createSkill: string;
    createSkillDesc: string;
    defaultSkills: string;
    setupRequired: string;
    enableSkill: string;
    welcomeTitle: string;
    welcomeDesc: string;
    collectTitle: string;
    collectDesc: string;
    ticketsTitle: string;
    ticketsDesc: string;
    transferTitle: string;
    transferDesc: string;
    recommendTitle: string;
    recommendDesc: string;
  };
  settingsPage: {
    title: string;
    description: string;
    aiProvider: string;
    aiProviderDescription: string;
    ollama: string;
    ollamaDescription: string;
    copilot: string;
    copilotDescription: string;
    connected: string;
    disconnected: string;
    checking: string;
    model: string;
    availableModels: string;
    copilotLoginInstructions: string;
    copilotNotAuthenticated: string;
    providerSelectionNotice: string;
  };
  launchGuide: {
    heading: string;
    createTitle: string;
    createDone: string;
    skillsCount: string;
    skillCollectDetails: string;
    skillTransfer: string;
    skillTickets: string;
    skillGreeting: string;
    createSkill: string;
    seeAllSkills: string;
    activateTitle: string;
    activateDone: string;
    answeringChats: string;
    viewProfile: string;
    trainTitle: string;
    trainIncomplete: string;
    trainDesc: string;
    addWebsite: string;
    addFiles: string;
    channelsTitle: string;
    channelsIncomplete: string;
    connectChannels: string;
    testimonial: string;
    testimonialAuthor: string;
    customerStory: string;
    previewLabel: string;
    resetPreview: string;
    agentSub: string;
    welcomeMessage: string;
    writeMessage: string;
    sendMessage: string;
    quickReply1: string;
    quickReply2: string;
    quickReply3: string;
  };
};

export const messages: Record<Locale, Messages> = {
  en: {
    nav: {
      launchGuide: "Launch guide",
      overview: "Overview",
      profile: "Profile",
      skills: "Skills",
      knowledge: "Knowledge",
      playground: "Playground",
      copilot: "Copilot",
      settings: "Settings",
      aiAgent: "Behzisti Smart Assistant",
    },
    knowledge: {
      title: "Knowledge",
      needsSetup: "Needs setup",
      ready: "Ready",
      all: "All",
      websites: "Websites",
      files: "Files",
      articles: "Articles",
      faq: "FAQ",
      newSource: "New source",
      addSource: "Add source",
      loading: "Loading internal knowledge…",
      emptyTitle: "Teach your Behzisti assistant",
      emptyDesc:
        "Add your docs, FAQs, or policies. The smart assistant will use this content to answer conversations.",
      websiteSoon: "Coming soon — public or internal docs page",
      circularHint: "data/knowledge/circulars/*.json",
      lawHint: "data/knowledge/laws/*.json",
      faqHint: "data/knowledge/faq/*.json",
      refreshSources: "Refresh sources",
      refreshHint: "Reload folder after adding JSON files",
      close: "Close",
      colName: "Name",
      colLastUpdated: "Last Updated",
      colAddedBy: "Added by",
      colActions: "Actions",
      addedBySystem: "Behzisti",
      viewSource: "View",
      removeSource: "Remove",
      noDate: "—",
      pagePrev: "Previous",
      pageNext: "Next",
      pageOf: "Page {page} of {totalPages}",
      rowsPerPage: "{from}–{to} of {total}",
      addSourceMenu: "Add source",
      addWebsite: "Website",
      addFile: "File",
      addArticle: "Article",
      addFaq: "FAQ",
      addDatabase: "Database connection",
      databaseSources: {
        title: "Database connections",
        description:
          "Connect a read-only AiTicket API. When enabled, all available redacted Dideban answer cases are synced locally for chat retrieval.",
        addConnection: "Add database connection",
        empty: "No database connections have been added.",
        loading: "Loading database connections…",
        name: "Connection name",
        endpoint: "AiTicket API address",
        endpointHint: "Set by DIDBAN_KNOWLEDGE_API on the app server (example: http://localhost:5088).",
        host: "Host / IP",
        connected: "Connected",
        disconnected: "Disconnected",
        enabled: "Using in chat",
        disabled: "Not used in chat",
        enable: "Use this connection in chat",
        settings: "Connection settings",
        sync: "Sync all cases",
        syncing: "Syncing cases…",
        syncedCases: "Cases synced",
        lastSync: "Last sync",
        neverSynced: "Not synced yet",
        test: "Test connection",
        testing: "Testing…",
        save: "Save connection",
        cancel: "Cancel",
        remove: "Remove connection",
        removeConfirm: "Remove this connection and its local synced index?",
        credentials: "Database credentials",
        credentialsHint:
          "SQL credentials remain on the AiTicket API server. This app does not store or reveal them.",
        historicalWarning:
          "Historical answers are unvalidated and may contain sensitive content. This app has no sign-in; anyone who can reach it can manage this source. Review access before enabling it or using a cloud AI provider.",
        testSuccess: "AiTicket API is reachable.",
      },
    },
    playground: {
      title: "Playground",
      needsSetup: "Needs setup",
      ready: "Ready",
      chooseScenario: "Choose testing scenario",
      chooseScenarioDesc:
        "Start with a suggested question, view and improve knowledge gaps, or write your own message.",
      suggested: "Suggested",
      knowledgeGaps: "Knowledge gaps",
      noSuggestedTitle: "No suggested questions",
      noSuggestedDesc:
        "We couldn't suggest questions based on your assistant's knowledge. Write your own message to test it.",
      noGapsTitle: "No knowledge gaps yet",
      noGapsDesc:
        "When the assistant can't answer confidently, gaps will show up here so you can improve your sources.",
      loadingSuggestions: "Loading suggestions…",
      welcome:
        "Good evening! Welcome to our preview chat—we're glad you're here. How can I help you today?",
      agentName: "Behzisti Smart Assistant",
      writeMessage: "Write a message…",
      send: "Send message",
      resetChat: "Reset chat",
      typing: "Behzisti Smart Assistant is typing…",
      details: "Details",
      collapseDetails: "Collapse details panel",
      noResponseTitle: "No response to analyze yet",
      noResponseDesc: "Send a message to see how Behzisti Smart Assistant answers and makes decisions.",
      provider: "Provider",
      confidence: "Confidence",
      sourcesUsed: "Sources used",
      noSourcesMatched: "No knowledge sources matched.",
    },
    profile: {
      name: "Name",
      status: "Status",
      acceptingChats: "Accepting chats",
      notAcceptingChats: "Not accepting chats",
      language: "Language",
      toneOfVoice: "Tone of voice",
      answerLength: "Answer length",
      customVoice: "Custom voice",
      editName: "Edit name",
      acceptChats: "Accept chats",
      english: "English",
      persian: "Persian",
      allLanguages: "All languages",
      friendly: "Friendly",
      professional: "Professional",
      casual: "Casual",
      empathetic: "Empathetic",
      short: "Short",
      medium: "Medium",
      long: "Long",
      uiLanguageHint: "Changes the app language and direction (LTR/RTL).",
    },
    overview: {
      knowledgeSources: "Knowledge sources",
      inUse: "in use",
      knowledgeDesc: "Add sources that teach your assistant to answer your way.",
      manageKnowledge: "Manage knowledge",
      skills: "Skills",
      active: "active",
      skillsDesc: "Add custom skills and your assistant resolves more chats on its own.",
      browseSkills: "Browse skills",
      performanceData: "Performance data",
      dateRange: "12–18 Nov vs 5–11 Nov",
      viewFullReport: "View full report",
      metricResolution: "AI resolution rate",
      metricChats: "Assistant chats",
      metricCsat: "Assistant CSAT score",
      metricTransferred: "Transferred chats",
      comparePercent: "vs 0% for previous period",
      compareCount: "vs 0 for previous period",
      knowledgeGaps: "Knowledge gaps",
      noGapsTitle: "No gaps so far.",
      noGapsDesc:
        "When one appears, teach your assistant once and it'll handle similar questions automatically.",
      gapsPreviewAlt: "Knowledge gaps preview",
    },
    skillsPage: {
      customSkills: "Custom skills",
      createSkill: "Create skill",
      createSkillDesc: "Tell your assistant when to act and what to do.",
      defaultSkills: "Default skills",
      setupRequired: "Setup required",
      enableSkill: "Enable skill",
      welcomeTitle: "Send welcome message",
      welcomeDesc: "Send a predefined or context-based welcome message when a chat starts.",
      collectTitle: "Collect client details",
      collectDesc: "Ask for the client's name and contact info at the start of a chat.",
      ticketsTitle: "Handle tickets",
      ticketsDesc: "Read, create, and update tickets when a chat needs follow-up.",
      transferTitle: "Transfer to human",
      transferDesc: "Transfer chats to a teammate on request or if the assistant can't help.",
      recommendTitle: "Recommend products",
      recommendDesc: "Suggest products from your catalog based on client needs.",
    },
    settingsPage: {
      title: "Settings",
      description: "Choose the AI provider used by conversations in this application.",
      aiProvider: "AI provider",
      aiProviderDescription: "Choose Ollama or GitHub Copilot.",
      ollama: "Ollama",
      ollamaDescription: "Run a model on your local Ollama service.",
      copilot: "GitHub Copilot",
      copilotDescription: "Generate answers with GitHub Copilot models.",
      connected: "Connected",
      disconnected: "Not connected",
      checking: "Checking…",
      model: "Model",
      availableModels: "Available models",
      copilotLoginInstructions:
        "To connect Copilot, sign in with an eligible GitHub Copilot account on the computer running this app. Run `copilot login` in a terminal as the same Windows user as the app.",
      copilotNotAuthenticated: "GitHub Copilot is not authenticated.",
      providerSelectionNotice:
        "Provider selection is shared by the app. When Copilot is selected, user questions and retrieved knowledge are sent to GitHub. If the selected provider is disconnected, chat requests show an error instead of silently switching models.",
    },
    launchGuide: {
      heading: "Launch Behzisti Smart Assistant",
      createTitle: "Create Behzisti Smart Assistant",
      createDone: "Create Behzisti Smart Assistant — done",
      skillsCount: "4 skills",
      skillCollectDetails: "Collect customer details",
      skillTransfer: "Transfer chats to humans",
      skillTickets: "Handle tickets",
      skillGreeting: "Send personalized greeting",
      createSkill: "Create skill",
      seeAllSkills: "See all skills",
      activateTitle: "Activate Behzisti Smart Assistant",
      activateDone: "Activate Behzisti Smart Assistant — done",
      answeringChats: "Answering chats",
      viewProfile: "View profile",
      trainTitle: "Train on your website or files",
      trainIncomplete: "Train on your website or files — incomplete",
      trainDesc: "Most teams hit 80% resolution rates from their website alone.",
      addWebsite: "Add website",
      addFiles: "Add files",
      channelsTitle: "Connect your channels",
      channelsIncomplete: "Connect your channels — incomplete",
      connectChannels: "Connect channels",
      testimonial:
        "We’re resolving over 80% of customer queries without human intervention, while maintaining strong customer satisfaction.",
      testimonialAuthor: "Alexandra at",
      customerStory: "Customer story",
      previewLabel: "Behzisti Smart Assistant preview",
      resetPreview: "Reset preview",
      agentSub: "Smart assistant",
      welcomeMessage:
        "Good morning! Welcome to our preview chat—it’s great to have you here. How can I assist you today?",
      writeMessage: "Write a message…",
      sendMessage: "Send message",
      quickReply1: "What services does Behzisti provide?",
      quickReply2: "How can I contact support?",
      quickReply3: "Where can I find more information?",
    },
  },
  fa: {
    nav: {
      launchGuide: "راهنمای راه‌اندازی",
      overview: "نمای کلی",
      profile: "پروفایل",
      skills: "مهارت‌ها",
      knowledge: "منابع دانش",
      playground: "آزمون کیفیت پاسخ ها",
      copilot: "دستیار کارشناس",
      settings: "تنظیمات",
      aiAgent: "دستیار هوشمند بهزیستی",
    },
    knowledge: {
      title: "منابع دانش",
      needsSetup: "نیاز به راه‌اندازی",
      ready: "آماده",
      all: "همه",
      websites: "وب‌سایت‌ها",
      files: "فایل‌ها",
      articles: "مقالات",
      faq: "پرسش‌های متداول",
      newSource: "منبع جدید",
      addSource: "افزودن منبع",
      loading: "در حال بارگذاری دانش سازمانی…",
      emptyTitle: "دانش سازمانی را به دستیار بیاموزید",
      emptyDesc:
        "اسناد، پرسش‌های متداول یا سیاست‌ها را اضافه کنید. دستیار هوشمند بهزیستی از این محتوا برای پاسخ به گفتگوها استفاده می‌کند.",
      websiteSoon: "به‌زودی — صفحه مستندات عمومی یا داخلی",
      circularHint: "data/knowledge/circulars/*.json",
      lawHint: "data/knowledge/laws/*.json",
      faqHint: "data/knowledge/faq/*.json",
      refreshSources: "بازخوانی منابع",
      refreshHint: "پس از افزودن فایل JSON پوشه را دوباره بارگذاری کنید",
      close: "بستن",
      colName: "نام",
      colLastUpdated: "آخرین به‌روزرسانی",
      colAddedBy: "افزوده‌شده توسط",
      colActions: "اقدامات",
      addedBySystem: "بهزیستی",
      viewSource: "مشاهده",
      removeSource: "حذف",
      noDate: "—",
      pagePrev: "قبلی",
      pageNext: "بعدی",
      pageOf: "صفحه {page} از {totalPages}",
      rowsPerPage: "{from}–{to} از {total}",
      addSourceMenu: "افزودن منبع",
      addWebsite: "وب‌سایت",
      addFile: "فایل",
      addArticle: "مقاله",
      addFaq: "پرسش‌های متداول",
      addDatabase: "اتصال پایگاه داده",
      databaseSources: {
        title: "اتصال‌های پایگاه داده",
        description:
          "اتصال فقط‌خواندنی به API سامانه AiTicket. با فعال‌سازی، همه پاسخ‌های تاریخیِ پالایش‌شده دیده‌بان برای بازیابی گفتگو به‌صورت محلی همگام می‌شوند.",
        addConnection: "افزودن اتصال پایگاه داده",
        empty: "هنوز اتصالی به پایگاه داده اضافه نشده است.",
        loading: "در حال بارگذاری اتصال‌های پایگاه داده…",
        name: "نام اتصال",
        endpoint: "نشانی API سامانه AiTicket",
        endpointHint: "از متغیر DIDBAN_KNOWLEDGE_API روی سرور برنامه تنظیم می‌شود (نمونه: http://localhost:5088).",
        host: "میزبان / IP",
        connected: "متصل",
        disconnected: "قطع",
        enabled: "استفاده در گفتگو",
        disabled: "عدم استفاده در گفتگو",
        enable: "استفاده از این اتصال در گفتگو",
        settings: "تنظیمات اتصال",
        sync: "همگام‌سازی همه پرونده‌ها",
        syncing: "در حال همگام‌سازی…",
        syncedCases: "پرونده همگام‌شده",
        lastSync: "آخرین همگام‌سازی",
        neverSynced: "هنوز همگام‌سازی نشده",
        test: "آزمایش اتصال",
        testing: "در حال آزمایش…",
        save: "ذخیره اتصال",
        cancel: "لغو",
        remove: "حذف اتصال",
        removeConfirm: "این اتصال و نمایه همگام‌شده محلی آن حذف شود؟",
        credentials: "اعتبارنامه پایگاه داده",
        credentialsHint:
          "اعتبارنامه‌های SQL فقط روی سرور API سامانه AiTicket نگهداری می‌شوند؛ این برنامه آن‌ها را ذخیره یا نمایش نمی‌دهد.",
        historicalWarning:
          "پاسخ‌های تاریخی اعتبارسنجی نشده‌اند و ممکن است محتوای حساس داشته باشند. این برنامه ورود کاربری ندارد و هر فرد دارای دسترسی به آن می‌تواند این منبع را مدیریت کند. پیش از فعال‌سازی یا استفاده با مدل ابری، دسترسی را بررسی کنید.",
        testSuccess: "اتصال به API سامانه AiTicket برقرار است.",
      },
    },
    playground: {
      title: "آزمون کیفیت پاسخ ها",
      needsSetup: "نیاز به راه‌اندازی",
      ready: "آماده",
      chooseScenario: "سناریوی آزمایش را انتخاب کنید",
      chooseScenarioDesc:
        "با یک سؤال پیشنهادی شروع کنید، شکاف‌های دانش را ببینید، یا پیام خودتان را بنویسید.",
      suggested: "پیشنهادی",
      knowledgeGaps: "شکاف‌های دانش",
      noSuggestedTitle: "سؤال پیشنهادی نیست",
      noSuggestedDesc:
        "بر اساس دانش فعلی دستیار، سؤالی پیشنهاد نشد. برای آزمایش، پیام خودتان را بنویسید.",
      noGapsTitle: "هنوز شکاف دانشی ثبت نشده",
      noGapsDesc:
        "وقتی دستیار با اطمینان پاسخ ندهد، شکاف‌ها اینجا نمایش داده می‌شوند تا منابع را بهبود دهید.",
      loadingSuggestions: "در حال بارگذاری پیشنهادها…",
      welcome:
        "عصر بخیر! خوش آمدید به چت پیش‌نمایش ما، خیلی خوشحالیم که اینجا هستید. چطور می‌توانم امروز به شما کمک کنم؟",
      agentName: "دستیار هوشمند بهزیستی",
      writeMessage: "پیام بنویسید…",
      send: "ارسال پیام",
      resetChat: "بازنشانی گفتگو",
      typing: "دستیار هوشمند بهزیستی در حال نوشتن است…",
      details: "جزئیات",
      collapseDetails: "بستن پنل جزئیات",
      noResponseTitle: "هنوز پاسخی برای تحلیل نیست",
      noResponseDesc:
        "پیامی بفرستید تا ببینید دستیار هوشمند بهزیستی چگونه پاسخ می‌دهد و تصمیم می‌گیرد.",
      provider: "ارائه‌دهنده",
      confidence: "اطمینان",
      sourcesUsed: "منابع استفاده‌شده",
      noSourcesMatched: "هیچ منبع دانشی مطابقت نداشت.",
    },
    profile: {
      name: "نام",
      status: "وضعیت",
      acceptingChats: "پذیرش گفتگو",
      notAcceptingChats: "عدم پذیرش گفتگو",
      language: "زبان",
      toneOfVoice: "لحن گفتار",
      answerLength: "طول پاسخ",
      customVoice: "صدای سفارشی",
      editName: "ویرایش نام",
      acceptChats: "پذیرش گفتگوها",
      english: "انگلیسی",
      persian: "فارسی",
      allLanguages: "همه زبان‌ها",
      friendly: "دوستانه",
      professional: "حرفه‌ای",
      casual: "غیررسمی",
      empathetic: "همدلانه",
      short: "کوتاه",
      medium: "متوسط",
      long: "بلند",
      uiLanguageHint: "زبان و جهت رابط کاربری (چپ‌به‌راست / راست‌به‌چپ) را تغییر می‌دهد.",
    },
    overview: {
      knowledgeSources: "منابع دانش",
      inUse: "در حال استفاده",
      knowledgeDesc: "منابعی اضافه کنید تا دستیار مطابق روش شما پاسخ دهد.",
      manageKnowledge: "مدیریت دانش",
      skills: "مهارت‌ها",
      active: "فعال",
      skillsDesc: "مهارت‌های سفارشی اضافه کنید تا دستیار گفتگوهای بیشتری را خودش حل کند.",
      browseSkills: "مشاهده مهارت‌ها",
      performanceData: "داده‌های عملکرد",
      dateRange: "۱۲–۱۸ آبان در برابر ۵–۱۱ آبان",
      viewFullReport: "مشاهده گزارش کامل",
      metricResolution: "نرخ پاسخ‌گویی خودکار",
      metricChats: "گفتگوهای دستیار",
      metricCsat: "امتیاز رضایت از دستیار",
      metricTransferred: "گفتگوهای منتقل‌شده",
      comparePercent: "در برابر ۰٪ دوره قبل",
      compareCount: "در برابر ۰ دوره قبل",
      knowledgeGaps: "شکاف‌های دانش",
      noGapsTitle: "هنوز شکافی نیست.",
      noGapsDesc:
        "وقتی شکافی ظاهر شود، یک‌بار به دستیار بیاموزید تا سؤالات مشابه را خودش پاسخ دهد.",
      gapsPreviewAlt: "پیش‌نمایش شکاف‌های دانش",
    },
    skillsPage: {
      customSkills: "مهارت‌های سفارشی",
      createSkill: "ایجاد مهارت",
      createSkillDesc: "به دستیار بگویید چه زمانی عمل کند و چه کاری انجام دهد.",
      defaultSkills: "مهارت‌های پیش‌فرض",
      setupRequired: "نیاز به راه‌اندازی",
      enableSkill: "فعال‌سازی مهارت",
      welcomeTitle: "ارسال پیام خوش‌آمدگویی",
      welcomeDesc: "در شروع گفتگو یک پیام خوش‌آمدگویی از پیش‌تعریف‌شده یا بر اساس زمینه ارسال کند.",
      collectTitle: "جمع‌آوری اطلاعات مراجعین",
      collectDesc: "در شروع گفتگو نام و اطلاعات تماس مراجعین را بپرسد.",
      ticketsTitle: "مدیریت درخواست‌ها",
      ticketsDesc: "در صورت نیاز به پیگیری، درخواست‌ها را بخواند، ایجاد یا به‌روزرسانی کند.",
      transferTitle: "انتقال به کارشناس",
      transferDesc: "درخواست مراجعین یا ناتوانی دستیار در پاسخ، گفتگو را به کارشناس منتقل کند.",
      recommendTitle: "پیشنهاد خدمات",
      recommendDesc: "بر اساس نیاز مراجعین، خدمات یا موارد مرتبط را پیشنهاد دهد.",
    },
    settingsPage: {
      title: "تنظیمات",
      description: "ارائه‌دهنده هوش مصنوعی مورد استفاده گفتگوها در این برنامه را انتخاب کنید.",
      aiProvider: "ارائه‌دهنده هوش مصنوعی",
      aiProviderDescription: "Ollama یا GitHub Copilot را انتخاب کنید.",
      ollama: "Ollama",
      ollamaDescription: "اجرای مدل از طریق سرویس محلی Ollama.",
      copilot: "GitHub Copilot",
      copilotDescription: "تولید پاسخ با مدل‌های GitHub Copilot.",
      connected: "متصل",
      disconnected: "متصل نیست",
      checking: "در حال بررسی…",
      model: "مدل",
      availableModels: "مدل‌های در دسترس",
      copilotLoginInstructions:
        "برای اتصال Copilot، با حساب واجد شرایط GitHub Copilot در رایانه‌ای که برنامه روی آن اجرا می‌شود وارد شوید. در ترمینال و با همان کاربر ویندوز برنامه، دستور `copilot login` را اجرا کنید.",
      copilotNotAuthenticated: "ورود به GitHub Copilot انجام نشده است.",
      providerSelectionNotice:
        "انتخاب ارائه‌دهنده برای کل برنامه مشترک است. با انتخاب Copilot، پرسش کاربران و اسناد بازیابی‌شده به GitHub فرستاده می‌شود. اگر ارائه‌دهنده انتخاب‌شده قطع باشد، گفتگو خطا می‌دهد و بی‌صدا به مدل دیگری تغییر نمی‌کند.",
    },
    launchGuide: {
      heading: "راه‌اندازی دستیار هوشمند بهزیستی",
      createTitle: "ایجاد دستیار هوشمند بهزیستی",
      createDone: "ایجاد دستیار هوشمند بهزیستی — انجام شد",
      skillsCount: "۴ مهارت",
      skillCollectDetails: "جمع‌آوری اطلاعات مراجعین",
      skillTransfer: "انتقال گفتگو به کارشناس",
      skillTickets: "مدیریت درخواست‌ها",
      skillGreeting: "ارسال پیام خوش‌آمدگویی",
      createSkill: "ایجاد مهارت",
      seeAllSkills: "مشاهده همه مهارت‌ها",
      activateTitle: "فعال‌سازی دستیار هوشمند بهزیستی",
      activateDone: "فعال‌سازی دستیار هوشمند بهزیستی — انجام شد",
      answeringChats: "در حال پاسخ به گفتگوها",
      viewProfile: "مشاهده پروفایل",
      trainTitle: "آموزش با وب‌سایت یا فایل‌ها",
      trainIncomplete: "آموزش با وب‌سایت یا فایل‌ها — ناتمام",
      trainDesc: "بیشتر تیم‌ها فقط با منابع وب‌سایت به نرخ پاسخ‌گویی حدود ۸۰٪ می‌رسند.",
      addWebsite: "افزودن وب‌سایت",
      addFiles: "افزودن فایل",
      channelsTitle: "اتصال کانال‌ها",
      channelsIncomplete: "اتصال کانال‌ها — ناتمام",
      connectChannels: "اتصال کانال‌ها",
      testimonial:
        "بیش از ۸۰٪ پرسش‌های مراجعین بدون دخالت کارشناس پاسخ داده می‌شود و رضایت مخاطبان حفظ می‌گردد.",
      testimonialAuthor: "الکساندرا در",
      customerStory: "داستان مشتری",
      previewLabel: "پیش‌نمایش دستیار هوشمند بهزیستی",
      resetPreview: "بازنشانی پیش‌نمایش",
      agentSub: "دستیار هوشمند",
      welcomeMessage:
        "عصر بخیر! خوش آمدید به چت پیش‌نمایش ما، بسیار خوشحالیم که اینجا هستید. چطور می‌توانم امروز به شما کمک کنم؟",
      writeMessage: "پیام بنویسید…",
      sendMessage: "ارسال پیام",
      quickReply1: "خدمات سازمان بهزیستی چیست؟",
      quickReply2: "چطور با پشتیبانی تماس بگیرم؟",
      quickReply3: "اطلاعات بیشتر را از کجا پیدا کنم؟",
    },
  },
};

export function localeFromProfileLanguage(value: string): Locale | null {
  const v = value.toLowerCase();
  if (v === "persian" || v === "فارسی" || v === "fa") return "fa";
  if (v === "english" || v === "انگلیسی" || v === "en") return "en";
  return null;
}

export function profileLanguageLabel(locale: Locale, t: Messages): string {
  return locale === "fa" ? t.profile.persian : t.profile.english;
}
