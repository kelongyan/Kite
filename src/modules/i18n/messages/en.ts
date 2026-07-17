import type { ShortcutGroup, ShortcutId } from "@/modules/shortcuts/shortcuts";

type LocalProviderMessageKey =
  | "lmstudio"
  | "mlx"
  | "ollama"
  | "openai-compatible"
  | "openrouter";

type CommandPaletteGroupKey =
  | "General"
  | "Spaces"
  | "Tabs"
  | "Panes"
  | "Git"
  | "Search"
  | "View"
  | "AI";

type CommandPaletteCommandKey =
  | "openSettings"
  | "changeTheme"
  | "keyboardShortcuts"
  | "spacesOverview"
  | "newSpace"
  | "newTerminal"
  | "newBlockTerminal"
  | "newPrivateTerminal"
  | "newEditorTab"
  | "newWebPreview"
  | "openSftp"
  | "closeTabOrPane"
  | "splitPaneRight"
  | "splitPaneDown"
  | "openGitGraph"
  | "toggleSourceControl"
  | "findContentInFiles"
  | "searchCommandHistory"
  | "findInCurrentTab"
  | "searchFilesByName"
  | "toggleFileExplorer"
  | "toggleAiAgent"
  | "askAiAboutSelection";

type CommandPaletteCommandMessage = {
  title: string;
  keywords: string[];
};

export type Messages = {
  common: {
    language: string;
    english: string;
    simplifiedChinese: string;
    loading: string;
    save: string;
    cancel: string;
    remove: string;
    edit: string;
    delete: string;
    replace: string;
    connected: string;
  };
  mainShell: {
    header: {
      settings: string;
      toggleSidebar: string;
      commandPalette: string;
    };
    search: {
      search: string;
      gitSearch: string;
      clearSearch: string;
    };
    tabs: {
      unsavedChanges: string;
      closeTab: string;
      renameTab: string;
      rename: string;
      close: string;
      newTab: string;
      newTabMenu: {
        terminal: string;
        blocks: string;
        privacy: string;
        editor: string;
        preview: string;
        sftp: string;
        gitGraph: string;
      };
      editorLanguage: {
        autoDetect: string;
        mode: (mode: string) => string;
        fewerLanguages: string;
        allLanguages: string;
      };
    };
    commandPalette: {
      title: string;
      description: string;
      placeholders: {
        themes: string;
        content: string;
        history: string;
        commands: string;
      };
      groups: Record<CommandPaletteGroupKey, string>;
      commands: Record<CommandPaletteCommandKey, CommandPaletteCommandMessage>;
      dynamic: {
        switchToSpace: (name: string) => string;
      };
      disabled: {
        noTerminalTab: string;
        paneLimit: string;
        lastTab: string;
        noWorkspaceRoot: string;
        currentSpace: string;
        noSearchableView: string;
      };
      headings: {
        themes: string;
        contents: string;
        commandHistory: string;
        searchModes: string;
      };
      status: {
        noThemes: string;
        noWorkspaceRoot: string;
        typeAtLeast2Characters: string;
        noMatches: string;
        openTerminalToRunHistory: string;
        noHistory: string;
        searchFailed: string;
        retry: string;
        searching: string;
        noCommandsFound: string;
      };
      modeHints: {
        history: string;
        content: string;
      };
      back: string;
    };
    spaces: {
      title: string;
      newSpace: string;
      renameSpace: string;
      newTab: string;
      deleteSpace: string;
      dropToMoveHere: string;
      noTabs: string;
      closeTab: string;
      expand: string;
      collapse: string;
    };
    sidebar: {
      files: string;
      sourceControl: string;
    };
    statusbar: {
      privateTerminal: {
        label: string;
        tooltip: string;
      };
      cwd: {
        noDirectory: string;
        home: string;
        loading: string;
        noSubfolders: string;
        showParentFolders: string;
      };
      workspaceEnv: {
        title: string;
        windowsLocal: string;
        loadingWslDistros: string;
        wslUnavailable: string;
        noWslDistros: string;
        refresh: string;
      };
    };
    workspaceInput: {
      branch: (name: string) => string;
      shellMode: string;
      aiMode: string;
    };
    workspaceSwitcher: {
      saveOrCloseUnsavedEditors: string;
    };
    closeDialogs: {
      unsavedTitle: string;
      dirtyFile: (title: string) => string;
      dirtyGeneric: string;
      closeTerminalTitle: string;
      terminalProcessDescription: string;
      deletedDirtyFile: (title: string) => string;
      deletedDirtyGeneric: string;
      deletedDirtyMultiple: (count: number) => string;
      closeAnyway: string;
    };
    terminalBlocks: {
      browseCommandHistory: string;
      autocompletePathsAndCommands: string;
      switchBetweenShellAndAi: string;
      openAiAssistant: string;
      commandFallback: string;
      runAgain: string;
      blockActions: string;
      copyCommand: string;
      copyOutput: string;
      copyCommandAndOutput: string;
      attachToAiChat: string;
      findInBlock: string;
      commandCopied: string;
      outputCopied: string;
      blockCopied: string;
      previous: string;
      next: string;
      close: string;
      inputPlaceholder: (shortcut: string) => string;
    };
  };
  workspace: {
    explorer: {
      noCurrentDirectory: string;
      loading: string;
      searchFiles: string;
      newFile: string;
      newFolder: string;
      refresh: string;
      open: string;
      openInTerminal: string;
      revealInFinder: string;
      revealInFileManager: string;
      delete: string;
      copyPath: string;
      copyRelativePath: string;
      attachToAgent: string;
      clickAgainToConfirm: string;
      searchPlaceholder: string;
      clearSearch: string;
      searching: string;
      noMatches: string;
      partialResults: string;
      copyFailed: (error: string) => string;
    };
    sftp: {
      title: string;
      notConnected: string;
      connect: string;
      disconnect: string;
      local: string;
      upload: string;
      download: string;
      actions: string;
      selectedCount: (count: number) => string;
      newFolder: string;
      rename: string;
      delete: string;
      skip: string;
      overwrite: string;
      conflictTitle: string;
      conflictDescription: (count: number) => string;
      moreConflicts: (count: number) => string;
      folderEmpty: string;
      loading: string;
      filter: string;
      remoteSearch: string;
      remoteSearchPrompt: string;
      remoteSearchResults: (count: number, query: string) => string;
      clearRemoteSearch: string;
      syncLocalToRemote: string;
      syncRemoteToLocal: string;
      syncPreviewTitle: string;
      syncPreviewDescription: (
        direction: "localToRemote" | "remoteToLocal",
      ) => string;
      syncOperation: string;
      syncCreate: string;
      syncOverwrite: string;
      syncSame: string;
      syncKeepDestination: string;
      syncConflict: string;
      syncKindMismatch: string;
      syncUnknownKind: string;
      syncNoChanges: string;
      syncNoDeletes: string;
      syncBlockedByConflicts: string;
      syncConfirmOverwrite: string;
      syncApply: (count: number) => string;
      syncCreateCount: (count: number) => string;
      syncOverwriteCount: (count: number) => string;
      syncUnchangedCount: (count: number) => string;
      syncKeptCount: (count: number) => string;
      syncConflictCount: (count: number) => string;
      tableName: string;
      tableDateModified: string;
      tableSize: string;
      tableKind: string;
      back: string;
      refresh: string;
      selectLocalFolder: string;
      connectionTitle: string;
      savedServers: string;
      newConnection: string;
      openFromTerminal: string;
      host: string;
      port: string;
      username: string;
      auth: string;
      password: string;
      savedPassword: string;
      privateKey: string;
      privateKeyPath: string;
      passphrase: string;
      remotePath: string;
      cancel: string;
      trustAndConnect: string;
      trustHostKey: string;
      hostKeyChanged: string;
      saveServerPrompt: string;
      serverName: string;
      saveAndClose: string;
      dontSave: string;
      transferQueue: string;
      noTransfers: string;
      clear: string;
      expand: string;
      collapse: string;
      runningCount: (count: number) => string;
      doneCount: (count: number) => string;
      failedCount: (count: number) => string;
      cancelTransfer: string;
      status: Record<
        "queued" | "running" | "done" | "failed" | "canceled",
        string
      >;
    };
    sourceControl: {
      title: string;
      noUpstream: string;
      loadingBranches: string;
      localBranches: string;
      worktrees: string;
      noBranchesFound: string;
      retry: string;
      cancel: string;
      waitForGitAction: string;
      stageChangesToCommit: string;
      enterCommitMessage: string;
      commitWithShortcut: (shortcut: string) => string;
      pushUnavailable: string;
      fetching: string;
      fetchFromRemote: string;
      pulling: string;
      branchDivergedResolve: string;
      noUpstreamConfigured: string;
      alreadyUpToDate: string;
      pullCommits: (count: number) => string;
      refreshSourceControl: string;
      commitGraph: string;
      loadingRepository: string;
      noRepository: string;
      noRepositoryBody: string;
      sourceControlError: string;
      unknownError: string;
      commitMessagePlaceholder: string;
      characterCount: (count: number) => string;
      toCommit: string;
      nothingStaged: string;
      stagedCount: (count: number) => string;
      committing: string;
      commit: string;
      pushing: string;
      push: string;
      changedFiles: string;
      discardChangesTitle: string;
      discardAllDescription: (label: string) => string;
      discardSingleDescription: (label: string) => string;
      discard: string;
      workingTreeClean: string;
      onBranchPrefix: string;
      divergedFromUpstream: string;
      resolveInTerminal: string;
      changes: string;
      all: string;
      stageAllChanges: string;
      discardPath: (path: string) => string;
      stagePath: (path: string) => string;
      openDiff: string;
      openFile: string;
      stage: string;
      unstage: string;
      discardChanges: string;
      copyRelativePath: string;
      copyAbsolutePath: string;
      revealInFinder: string;
      revealInFileManager: string;
      stageChangesToGenerate: string;
      connectAiProvider: string;
      waitForAiAction: string;
      generateCommitMessage: string;
      configureBranchForPush: string;
      pullBeforePush: string;
      noLocalCommitsToPush: (upstream: string) => string;
      pushesTo: (upstream: string) => string;
      divergedRemoteIndicator: string;
      pullRemoteCommits: (count: number) => string;
      pushLocalCommits: (count: number) => string;
      sync: string;
      fetchRemoteUpdates: string;
      noStagedChanges: string;
      noUnstagedChanges: string;
      invalidAiCommitMessage: string;
      committed: (shortSha: string, summary: string) => string;
      pushedTo: (upstream: string) => string;
      pushCompleted: string;
      unstagedFiles: (count: number) => string;
    };
    gitHistory: {
      unknownError: string;
      loadingCommits: string;
      couldNotLoadHistory: string;
      retry: string;
      noCommitsYet: string;
      branchHasNoCommits: string;
      sha: string;
      subject: string;
      author: string;
      date: string;
      changes: string;
      loadingMore: string;
      endOfHistory: string;
      failedToLoadMore: string;
      noSubject: string;
      unknown: string;
      filesChanged: (count: number) => string;
      copied: string;
      copySha: string;
      loadingFiles: string;
      noFileChanges: string;
      files: string;
      binary: string;
    };
    editor: {
      newFileTitle: string;
      newFileDescription: string;
      nameRequired: string;
      pathMustBeRelative: string;
      noWorkspaceRoot: string;
      cancel: string;
      create: string;
      loading: string;
      binaryFile: string;
      fileTooLarge: string;
      previewNotSupported: string;
      binaryPatchFallback: string;
      largeFilePatchView: string;
      loadingDiff: string;
      diffPreviewUnavailable: string;
      aiDiffStatus: {
        pending: string;
        approved: string;
        rejected: string;
      };
      newFileBadge: string;
      saveToPreview: string;
      accept: string;
      reject: string;
    };
    preview: {
      title: string;
      xfoHint: string;
      suspendedTitle: string;
      suspendedBody: string;
      reload: string;
      emptyTitle: string;
      emptyBodyPrefix: string;
      ports: string;
      emptyBodySuffix: string;
      enterUrlOrPort: string;
      noServerListening: (port: number) => string;
      commonPorts: string;
      checking: string;
      openInSystemBrowser: string;
      dismiss: string;
    };
    markdown: {
      rendered: string;
      raw: string;
      loading: string;
      readFailed: (message: string) => string;
      binaryCannotRender: string;
      fileTooLarge: (size: number, limit: number) => string;
    };
  };
  ai: {
    chat: {
      emptyTitle: string;
      emptyDescription: string;
      thinking: string;
      errorTitle: string;
      dismiss: string;
      contextCompacted: (count: number) => string;
      stepLimit: string;
      continue: string;
      editorSelection: string;
      terminalSelection: string;
      read: string;
      fileCount: (count: number) => string;
      openAiLog: string;
      error: string;
      askKite: string;
      removeCommand: string;
      removeSnippet: string;
      linesShort: (count: number) => string;
    };
    input: {
      connectProviderHint: string;
      connectProvider: string;
      placeholder: string;
      listening: string;
      transcribing: string;
      transcriptionFailed: string;
      microphoneAccessFailed: string;
      openAiAgent: string;
      attachFileOrImage: string;
      voiceNeedsKey: (provider: string) => string;
      stopAndTranscribe: string;
      voiceInput: string;
      closeAiPanel: string;
      miniWindowOpen: string;
      openConversation: string;
      stop: string;
      send: string;
      modelTitle: (model: string) => string;
      modelNoKey: (model: string) => string;
      searchModels: string;
      all: string;
      favorites: string;
      recent: string;
      allProviders: string;
      providerNotConfigured: (provider: string) => string;
      noFavorites: string;
      noRecent: string;
      noModelsMatch: string;
      configureProvider: (provider: string) => string;
      open: string;
      favorite: string;
      unfavorite: string;
      intelligence: string;
      speed: string;
      affordability: string;
    };
    mini: {
      planMode: string;
      queued: (count: number) => string;
      noEditsQueued: string;
      exit: string;
      loadingSessions: string;
      close: string;
      closeEsc: string;
      switchSession: string;
      newChat: string;
      untitledSession: string;
      newSession: string;
      deleteSession: string;
      emptyTitle: string;
      emptyDescription: string;
      suggestions: {
        explainError: { label: string; hint: string; text: string };
        generateCommand: { label: string; hint: string; text: string };
        summarizeBuffer: { label: string; hint: string; text: string };
      };
      context: {
        model: string;
        lastRequest: string;
        estimatedContext: string;
        ofWhichCached: string;
        sessionInput: string;
        sessionOutput: string;
        cacheHit: string;
        sessionCost: string;
        window: string;
        lastRequestNote: string;
        approximateNote: string;
      };
    };
    approval: {
      needsApproval: string;
      deny: string;
      approve: string;
      reviewInDiffTab: string;
      replaceAll: string;
      lineCount: (count: number) => string;
      editCount: (count: number) => string;
      tools: {
        write_file: string;
        edit: string;
        multi_edit: string;
        create_directory: string;
        bash_run: string;
        bash_background: string;
      };
    };
    planDiff: {
      title: string;
      pendingChange: (count: number) => string;
      discardAll: string;
      apply: (count: number) => string;
      toggleDiff: string;
      new: string;
      multiEdit: string;
      createDirectory: string;
      reject: string;
      noLineLevelChanges: string;
      moreChanges: (count: number) => string;
    };
    pickers: {
      workspaceFiles: string;
      noWorkspaceOpen: string;
      indexingWorkspace: string;
      noMatchingFiles: string;
      refineLargeWorkspace: string;
      noSnippetMatches: string;
      prebuiltSnippets: string;
      snippets: string;
    };
    slashCommands: Record<"init" | "plan" | "claude-code", string>;
    agentSwitcher: {
      agentTitle: (name: string) => string;
      builtIn: string;
      custom: string;
      manageAgents: string;
      builtInAgents: Record<
        "builtin:coder" | "builtin:architect" | "builtin:reviewer" | "builtin:security" | "builtin:designer",
        { name: string; description: string }
      >;
    };
    todo: {
      title: string;
    };
    notifications: {
      localAgent: string;
      approvalTitle: string;
      approvalBody: string;
      runFailedTitle: string;
      finishedTitle: string;
      finishedBody: string;
      agentNeedsInput: (name: string) => string;
      agentFinished: (name: string) => string;
      waiting: string;
      working: string;
      labels: {
        attention: string;
        finished: string;
        error: string;
      };
      enabled: string;
      enabling: string;
      enable: string;
      title: string;
      activeCount: (count: number) => string;
      clear: string;
      emptyLine1: string;
      emptyLine2: string;
      agentAlerts: string;
      open: string;
      justNow: string;
      minutesAgo: (count: number) => string;
      hoursAgo: (count: number) => string;
      daysAgo: (count: number) => string;
    };
    tool: {
      labels: Record<
        | "read_file"
        | "list_directory"
        | "write_file"
        | "create_directory"
        | "edit"
        | "multi_edit"
        | "bash_run"
        | "bash_background"
        | "bash_logs"
        | "bash_list"
        | "bash_kill"
        | "grep"
        | "glob"
        | "suggest_command"
        | "open_preview"
        | "run_subagent"
        | "todo_write",
        string
      >;
      status: {
        approvalRequested: string;
        approvalResponded: string;
        inputStreaming: string;
        inputAvailable: string;
        outputAvailable: string;
        outputDenied: string;
        outputError: string;
      };
      input: string;
      output: string;
      error: string;
      failed: string;
      itemCount: (count: number) => string;
      lineCount: (count: number) => string;
      empty: string;
      read: string;
      noMatches: string;
      filesScanned: (count: number) => string;
      hitCount: (count: number) => string;
      filesCount: (count: number) => string;
      truncated: string;
      replacementCount: (count: number) => string;
      created: string;
      wrote: string;
      running: string;
      timedOut: string;
      cwdAfter: (cwd: string) => string;
      insertIntoActiveTerminal: string;
      inserted: string;
      insert: string;
      generatingCode: string;
      generating: (label: string) => string;
      runInActiveTerminal: string;
      sent: string;
      run: string;
      copyCode: string;
      copy: string;
      modelContextUsage: string;
      previousBranch: string;
      nextBranch: string;
      branchPage: (current: number, total: number) => string;
      usageInput: string;
      usageOutput: string;
      usageReasoning: string;
      usageCache: string;
    };
    reasoning: {
      thinking: string;
      reasoned: string;
      reasonedFor: (seconds: number) => string;
    };
  };
  settings: {
    tabs: {
      general: string;
      themes: string;
      shortcuts: string;
      models: string;
      agents: string;
      about: string;
    };
    general: {
      title: string;
      description: string;
      appearance: {
        title: string;
        system: string;
        light: string;
        dark: string;
        themesHint: string;
        themesTab: string;
        themesHintSuffix: string;
      };
      language: {
        title: string;
        description: string;
      };
      languageTitle: string;
      languageDescription: string;
      zoom: {
        title: string;
        uiZoomLevel: string;
      };
      editor: {
        title: string;
        vimMode: string;
        vimModeDescription: string;
        wordWrap: string;
        wordWrapDescription: string;
        autoSave: string;
        autoSaveDescription: string;
        autoSaveDelay: string;
        autoSaveDelayDescription: string;
      };
      explorer: {
        title: string;
        showHiddenFiles: string;
        showHiddenFilesDescription: string;
        gitDecorations: string;
        gitDecorationsDescription: string;
      };
      terminal: {
        title: string;
        useWebgl: string;
        webglAria: string;
        webglTooltip: string;
        webglDescription: string;
        fontFamily: string;
        fontFamilyPlaceholder: string;
        fontWeight: string;
        fontWeightDescription: string;
        fontWeights: {
          normal: string;
          medium: string;
          semiBold: string;
          bold: string;
        };
        shell: string;
        shellUnavailableDescription: string;
        shellWithWslDescription: string;
        shellDescription: string;
        autoShell: string;
        workspaceEnvironment: string;
        workspaceEnvironmentDescription: string;
        unavailable: string;
        letterSpacing: string;
        letterSpacingDescription: string;
        fontSize: string;
        fontSizeDescription: string;
        scrollback: string;
        scrollbackDescription: string;
        scrollbackLines: (lines: string) => string;
      };
      agents: {
        title: string;
        notifications: string;
        notificationsDescription: string;
      };
      startup: {
        title: string;
        launchAtLogin: string;
        launchAtLoginDescription: string;
        restoreWindow: string;
        restoreWindowDescription: string;
      };
    };
    themes: {
      title: string;
      description: string;
      theme: {
        title: string;
        create: string;
        importTheme: string;
        failedToRead: string;
        editTheme: (name: string) => string;
        removeTheme: (name: string) => string;
      };
      editorTheme: {
        title: string;
        description: string;
        auto: string;
      };
      background: {
        title: string;
        remove: string;
        replaceImage: string;
        chooseImage: string;
        notImage: string;
        failedToImportImage: string;
        opacity: string;
        blur: string;
        emptyHint: string;
      };
    };
    shortcuts: {
      title: string;
      description: string;
      resetAll: string;
      searchPlaceholder: string;
      unassigned: string;
      resetToDefault: string;
      clearShortcut: string;
      recording: string;
      escToCancel: string;
      resetDialogTitle: string;
      resetDialogDescription: string;
      groups: Record<ShortcutGroup, string>;
      actions: Record<ShortcutId, string>;
    };
    models: {
      title: string;
      description: string;
      defaults: string;
      chatModel: string;
      autocomplete: string;
      providers: {
        title: string;
        add: string;
        cloud: string;
        localAndCustom: string;
        emptyTitle: string;
        emptyDescription: string;
        removeProvider: string;
        removeEndpoint: string;
        removeKey: string;
        connected: string;
        notConnected: string;
        needsConnection: (provider: string) => string;
      };
      fields: {
        name: string;
        baseUrl: string;
        modelId: string;
        context: string;
        tokens: string;
        apiKey: string;
        provider: string;
        model: string;
      };
      localMeta: Record<
        LocalProviderMessageKey,
        {
          description: string;
          modelHintBefore?: string;
          modelHintCode?: string;
          modelHintAfter?: string;
        }
      >;
      localProvider: {
        docs: string;
        test: string;
        optionalApiKeyPlaceholder: string;
        save: string;
        testing: string;
        reachable: string;
        unreachable: string;
        myEndpointPlaceholder: string;
      };
      voice: {
        title: string;
        openaiDescription: string;
        groqDescription: string;
        whispercppDescription: string;
      };
      providerKeyCard: {
        enterKey: string;
        keyPrefixError: (provider: string, prefix: string) => string;
        failedToSave: (error: string) => string;
        getKey: string;
        removeProvider: string;
        pasteApiKey: string;
        showKey: string;
        hideKey: string;
        replace: string;
        remove: string;
      };
    };
    agents: {
      title: string;
      description: string;
      customInstructions: {
        title: string;
        placeholder: string;
      };
      agents: {
        title: string;
        new: string;
        newDefaultName: string;
        builtIn: string;
        active: string;
        useAgent: string;
        edit: string;
        delete: string;
        dialogNewTitle: string;
        dialogEditTitle: string;
        icon: string;
        name: string;
        namePlaceholder: string;
        description: string;
        descriptionPlaceholder: string;
        instructions: string;
        instructionsPlaceholder: string;
      };
      snippets: {
        title: string;
        descriptionPrefix: string;
        descriptionSuffix: string;
        new: string;
        emptyPrefix: string;
        emptySuffix: string;
        edit: string;
        delete: string;
        dialogNewTitle: string;
        dialogEditTitle: string;
        handle: string;
        name: string;
        description: string;
        content: string;
        handlePlaceholder: string;
        namePlaceholder: string;
        descriptionPlaceholder: string;
        contentPlaceholder: string;
        handleRequired: string;
        handleInvalid: string;
        handleInUse: string;
      };
    };
    about: {
      title: string;
      tagline: string;
      build: string;
      bundleId: string;
      license: string;
      sourceCode: string;
      projectPage: string;
      updatesDisabled: string;
      updateChecksDisabled: string;
      actions: {
        viewOnGitHub: string;
        reportIssue: string;
      };
    };
  };
};

export const en: Messages = {
  common: {
    language: "Language",
    english: "English",
    simplifiedChinese: "简体中文",
    loading: "Loading...",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    edit: "Edit",
    delete: "Delete",
    replace: "Replace",
    connected: "Connected",
  },
  mainShell: {
    header: {
      settings: "Settings",
      toggleSidebar: "Toggle sidebar",
      commandPalette: "Command palette",
    },
    search: {
      search: "Search",
      gitSearch: "Git search",
      clearSearch: "Clear search",
    },
    tabs: {
      unsavedChanges: "Unsaved changes",
      closeTab: "Close tab",
      renameTab: "Rename tab",
      rename: "Rename",
      close: "Close",
      newTab: "New tab",
      newTabMenu: {
        terminal: "Terminal",
        blocks: "Blocks",
        privacy: "Privacy",
        editor: "Editor",
        preview: "Preview",
        sftp: "SFTP",
        gitGraph: "Git Graph",
      },
      editorLanguage: {
        autoDetect: "Auto Detect",
        mode: (mode) => `Mode: ${mode}`,
        fewerLanguages: "Fewer languages",
        allLanguages: "All languages",
      },
    },
    commandPalette: {
      title: "Command Palette",
      description: "Run a command, switch theme, or search your workspace.",
      placeholders: {
        themes: "Search themes...",
        content: "Find text in files...",
        history: "Search command history...",
        commands: "Type a command, > for history, # to find in files",
      },
      groups: {
        General: "General",
        Spaces: "Spaces",
        Tabs: "Tabs",
        Panes: "Panes",
        Git: "Git",
        Search: "Search",
        View: "View",
        AI: "AI",
      },
      commands: {
        openSettings: {
          title: "Open settings",
          keywords: ["preferences", "config"],
        },
        changeTheme: {
          title: "Change theme...",
          keywords: ["theme", "appearance", "color", "dark", "light"],
        },
        keyboardShortcuts: {
          title: "Keyboard shortcuts",
          keywords: ["keys", "keybindings", "settings"],
        },
        spacesOverview: {
          title: "Spaces: Overview",
          keywords: [
            "spaces",
            "sessions",
            "overview",
            "organize",
            "manage",
            "move",
          ],
        },
        newSpace: {
          title: "New Space",
          keywords: ["space", "session", "workspace", "group", "create"],
        },
        newTerminal: {
          title: "New terminal",
          keywords: ["shell", "terminal", "new tab"],
        },
        newBlockTerminal: {
          title: "New block terminal",
          keywords: ["blocks", "warp", "command blocks", "terminal"],
        },
        newPrivateTerminal: {
          title: "New private terminal",
          keywords: ["privacy", "private", "incognito", "hidden from ai"],
        },
        newEditorTab: {
          title: "New editor tab",
          keywords: ["file", "editor", "create"],
        },
        newWebPreview: {
          title: "New web preview",
          keywords: ["browser", "web", "localhost", "preview"],
        },
        openSftp: {
          title: "Open SFTP",
          keywords: ["sftp", "ssh", "file transfer", "server"],
        },
        closeTabOrPane: {
          title: "Close tab or pane",
          keywords: ["close", "remove", "pane"],
        },
        splitPaneRight: {
          title: "Split pane right",
          keywords: ["terminal", "pane", "split", "right", "column"],
        },
        splitPaneDown: {
          title: "Split pane down",
          keywords: ["terminal", "pane", "split", "down", "row"],
        },
        openGitGraph: {
          title: "Open git graph",
          keywords: ["git", "graph", "history", "log", "commits"],
        },
        toggleSourceControl: {
          title: "Toggle source control",
          keywords: ["git", "source control", "changes", "staging", "diff"],
        },
        findContentInFiles: {
          title: "Find content in files",
          keywords: ["grep", "ripgrep", "text", "contents", "search in files"],
        },
        searchCommandHistory: {
          title: "Search command history",
          keywords: ["history", "shell", "rerun", "previous commands"],
        },
        findInCurrentTab: {
          title: "Find in current tab",
          keywords: ["find", "terminal", "editor", "current"],
        },
        searchFilesByName: {
          title: "Search files by name",
          keywords: ["explorer", "workspace", "file", "open"],
        },
        toggleFileExplorer: {
          title: "Toggle file explorer",
          keywords: ["sidebar", "files", "explorer"],
        },
        toggleAiAgent: {
          title: "Toggle AI agent",
          keywords: ["assistant", "chat", "agent"],
        },
        askAiAboutSelection: {
          title: "Ask AI about selection",
          keywords: ["selection", "explain", "assistant", "chat"],
        },
      },
      dynamic: {
        switchToSpace: (name) => `Switch to ${name}`,
      },
      disabled: {
        noTerminalTab: "No terminal tab",
        paneLimit: "Pane limit",
        lastTab: "Last tab",
        noWorkspaceRoot: "No workspace root",
        currentSpace: "Current space",
        noSearchableView: "No searchable view",
      },
      headings: {
        themes: "Themes",
        contents: "Contents",
        commandHistory: "Command history",
        searchModes: "Search modes",
      },
      status: {
        noThemes: "No themes",
        noWorkspaceRoot: "No workspace root",
        typeAtLeast2Characters: "Type at least 2 characters",
        noMatches: "No matches",
        openTerminalToRunHistory: "Open a terminal to run history",
        noHistory: "No history",
        searchFailed: "Search failed",
        retry: "Retry",
        searching: "Searching...",
        noCommandsFound: "No commands found. Type ? to see search modes.",
      },
      modeHints: {
        history: "Search command history",
        content: "Find text in files",
      },
      back: "Back",
    },
    sidebar: {
      files: "Files",
      sourceControl: "Source Control",
    },
    spaces: {
      title: "Spaces",
      newSpace: "New space",
      renameSpace: "Rename space",
      newTab: "New tab",
      deleteSpace: "Delete space",
      dropToMoveHere: "Drop to move here",
      noTabs: "No tabs",
      closeTab: "Close tab",
      expand: "Expand",
      collapse: "Collapse",
    },
    statusbar: {
      privateTerminal: {
        label: "Private: hidden from AI",
        tooltip:
          "AI can't see this terminal's output. Use it for secrets, SSH, or anything you don't want sent to the model.",
      },
      cwd: {
        noDirectory: "no directory",
        home: "Home",
        loading: "Loading...",
        noSubfolders: "No subfolders",
        showParentFolders: "Show parent folders",
      },
      workspaceEnv: {
        title: "Workspace environment",
        windowsLocal: "Windows Local",
        loadingWslDistros: "Loading WSL distros...",
        wslUnavailable: "WSL unavailable",
        noWslDistros: "No WSL distros found",
        refresh: "Refresh",
      },
    },
    workspaceInput: {
      branch: (name) => `Branch: ${name}`,
      shellMode: "Shell",
      aiMode: "AI",
    },
    workspaceSwitcher: {
      saveOrCloseUnsavedEditors:
        "Save or close unsaved editor tabs before switching workspace.",
    },
    closeDialogs: {
      unsavedTitle: "Unsaved Changes",
      dirtyFile: (title) => `"${title}" has unsaved changes. Close anyway?`,
      dirtyGeneric: "This file has unsaved changes. Close anyway?",
      closeTerminalTitle: "Close Terminal?",
      terminalProcessDescription:
        "A process is running. Closing this tab will terminate it.",
      deletedDirtyFile: (title) =>
        `"${title}" has unsaved changes. The file has been deleted. Close anyway?`,
      deletedDirtyGeneric:
        "This file has unsaved changes. The file has been deleted. Close anyway?",
      deletedDirtyMultiple: (count) =>
        `${count} files have unsaved changes. They have been deleted. Close all anyway?`,
      closeAnyway: "Close Anyway",
    },
    terminalBlocks: {
      browseCommandHistory: "Browse your command history",
      autocompletePathsAndCommands: "Autocomplete paths and commands",
      switchBetweenShellAndAi: "Switch between Shell and AI",
      openAiAssistant: "Open the AI assistant",
      commandFallback: "command",
      runAgain: "Run again",
      blockActions: "Block actions",
      copyCommand: "Copy command",
      copyOutput: "Copy output",
      copyCommandAndOutput: "Copy command and output",
      attachToAiChat: "Attach to AI chat",
      findInBlock: "Find in block",
      commandCopied: "Command copied",
      outputCopied: "Output copied",
      blockCopied: "Block copied",
      previous: "Previous",
      next: "Next",
      close: "Close",
      inputPlaceholder: (shortcut) =>
        `Run a command  -  ↑ history  ${shortcut} switch to AI`,
    },
  },
  workspace: {
    explorer: {
      noCurrentDirectory: "No current directory",
      loading: "Loading...",
      searchFiles: "Search files",
      newFile: "New file",
      newFolder: "New folder",
      refresh: "Refresh",
      open: "Open",
      openInTerminal: "Open in Terminal",
      revealInFinder: "Reveal in Finder",
      revealInFileManager: "Reveal in File Manager",
      delete: "Delete",
      copyPath: "Copy Path",
      copyRelativePath: "Copy Relative Path",
      attachToAgent: "Attach to Agent",
      clickAgainToConfirm: "Click again to confirm",
      searchPlaceholder: "Search files...",
      clearSearch: "Clear search",
      searching: "Searching...",
      noMatches: "No matches",
      partialResults: "Showing partial results - refine your query.",
      copyFailed: (error) => `Copy failed: ${error}`,
    },
    sftp: {
      title: "SFTP",
      notConnected: "Not connected",
      connect: "Connect",
      disconnect: "Disconnect",
      local: "Local",
      upload: "Upload",
      download: "Download",
      actions: "Actions",
      selectedCount: (count) => `${count} selected`,
      newFolder: "New folder",
      rename: "Rename",
      delete: "Delete",
      skip: "Skip",
      overwrite: "Overwrite",
      conflictTitle: "Name conflict",
      conflictDescription: (count) =>
        `${count} item${count === 1 ? "" : "s"} already exist at the destination.`,
      moreConflicts: (count) => `+${count} more`,
      folderEmpty: "This folder is empty",
      loading: "Loading...",
      filter: "Filter",
      remoteSearch: "Search remote",
      remoteSearchPrompt: "Search remote filenames from the current folder",
      remoteSearchResults: (count, query) => `${count} results for "${query}"`,
      clearRemoteSearch: "Clear remote search",
      syncLocalToRemote: "Preview sync to remote",
      syncRemoteToLocal: "Preview sync to local",
      syncPreviewTitle: "Sync preview",
      syncPreviewDescription: (direction) =>
        direction === "localToRemote"
          ? "Local entries will be copied to the current remote folder."
          : "Remote entries will be copied to the current local folder.",
      syncOperation: "Operation",
      syncCreate: "Create",
      syncOverwrite: "Overwrite",
      syncSame: "Same",
      syncKeepDestination: "Keep",
      syncConflict: "Conflict",
      syncKindMismatch: "File and folder types do not match.",
      syncUnknownKind: "unknown",
      syncNoChanges: "No changes to apply",
      syncNoDeletes: "Sync does not delete destination-only files.",
      syncBlockedByConflicts: "Resolve conflicts before applying this sync.",
      syncConfirmOverwrite: "Allow this sync to overwrite destination files.",
      syncApply: (count) => `Apply ${count}`,
      syncCreateCount: (count) => `${count} create`,
      syncOverwriteCount: (count) => `${count} overwrite`,
      syncUnchangedCount: (count) => `${count} same`,
      syncKeptCount: (count) => `${count} kept`,
      syncConflictCount: (count) => `${count} conflict`,
      tableName: "Name",
      tableDateModified: "Date Modified",
      tableSize: "Size",
      tableKind: "Kind",
      back: "Back",
      refresh: "Refresh",
      selectLocalFolder: "Select local folder",
      connectionTitle: "SFTP Connection",
      savedServers: "Saved servers",
      newConnection: "New connection",
      openFromTerminal: "Open SFTP from current directory",
      host: "Host",
      port: "Port",
      username: "Username",
      auth: "Auth",
      password: "Password",
      savedPassword: "Saved",
      privateKey: "Private key",
      privateKeyPath: "Private key path",
      passphrase: "Passphrase",
      remotePath: "Remote path",
      cancel: "Cancel",
      trustAndConnect: "Trust & Connect",
      trustHostKey: "Trust host key",
      hostKeyChanged: "Host key changed",
      saveServerPrompt: "Connected! Save this server for quick access?",
      serverName: "Server name",
      saveAndClose: "Save & Close",
      dontSave: "Don't save",
      transferQueue: "Transfer Queue",
      noTransfers: "No transfers",
      clear: "Clear",
      expand: "Expand",
      collapse: "Collapse",
      runningCount: (count) => `${count} running`,
      doneCount: (count) => `${count} done`,
      failedCount: (count) => `${count} failed`,
      cancelTransfer: "Cancel transfer",
      status: {
        queued: "queued",
        running: "running",
        done: "done",
        failed: "failed",
        canceled: "canceled",
      },
    },
    sourceControl: {
      title: "Source Control",
      noUpstream: "No upstream",
      loadingBranches: "Loading branches...",
      localBranches: "Local Branches",
      worktrees: "Worktrees",
      noBranchesFound: "No branches found.",
      retry: "Retry",
      cancel: "Cancel",
      waitForGitAction: "Wait for the current Git action to finish.",
      stageChangesToCommit: "Stage changes to enable commit.",
      enterCommitMessage: "Enter a commit message to enable commit.",
      commitWithShortcut: (shortcut) => `Commit with ${shortcut}.`,
      pushUnavailable: "Push is unavailable right now.",
      fetching: "Fetching...",
      fetchFromRemote: "Fetch from remote",
      pulling: "Pulling...",
      branchDivergedResolve: "Branch diverged - resolve in terminal",
      noUpstreamConfigured: "No upstream configured",
      alreadyUpToDate: "Already up to date",
      pullCommits: (count) =>
        `Pull ${count} ${count === 1 ? "commit" : "commits"} (fast-forward)`,
      refreshSourceControl: "Refresh source control",
      commitGraph: "Commit Graph",
      loadingRepository: "Loading repository",
      noRepository: "No repository",
      noRepositoryBody: "The active workspace is not inside a Git repository.",
      sourceControlError: "Source control error",
      unknownError: "Unknown source control error",
      commitMessagePlaceholder: "Commit message",
      characterCount: (count) => `Ch: ${count}`,
      toCommit: "to commit",
      nothingStaged: "Nothing staged",
      stagedCount: (count) =>
        `${count} ${count === 1 ? "file" : "files"} staged`,
      committing: "Committing...",
      commit: "Commit",
      pushing: "Pushing...",
      push: "Push",
      changedFiles: "Changed files",
      discardChangesTitle: "Discard changes?",
      discardAllDescription: (label) =>
        `This will discard ${label} and cannot be undone.`,
      discardSingleDescription: (label) =>
        `Discard changes in "${label}"? This cannot be undone.`,
      discard: "Discard",
      workingTreeClean: "Working tree clean",
      onBranchPrefix: "on",
      divergedFromUpstream: "Diverged from upstream",
      resolveInTerminal: "resolve in terminal",
      changes: "Changes",
      all: "All",
      stageAllChanges: "Stage all changes",
      discardPath: (path) => `Discard ${path}`,
      stagePath: (path) => `Stage ${path}`,
      openDiff: "Open Diff",
      openFile: "Open File",
      stage: "Stage",
      unstage: "Unstage",
      discardChanges: "Discard Changes",
      copyRelativePath: "Copy Relative Path",
      copyAbsolutePath: "Copy Absolute Path",
      revealInFinder: "Reveal in Finder",
      revealInFileManager: "Reveal in File Manager",
      stageChangesToGenerate: "Stage changes to generate a commit message",
      connectAiProvider: "Connect an AI provider to generate commit messages",
      waitForAiAction: "Wait for the current AI action to finish",
      generateCommitMessage: "Generate commit message",
      configureBranchForPush:
        "Configure or publish this branch in the terminal to enable push in this iteration.",
      pullBeforePush: "Pull remote changes before pushing local commits.",
      noLocalCommitsToPush: (upstream) =>
        `No local commits to push to ${upstream}.`,
      pushesTo: (upstream) => `Pushes to ${upstream}.`,
      divergedRemoteIndicator:
        "Branch has diverged from upstream. Use Source Control or the terminal to resolve it.",
      pullRemoteCommits: (count) =>
        `Pull ${count} remote ${count === 1 ? "commit" : "commits"} with fast-forward only.`,
      pushLocalCommits: (count) =>
        `Push ${count} local ${count === 1 ? "commit" : "commits"}.`,
      sync: "Sync",
      fetchRemoteUpdates: "Fetch remote updates.",
      noStagedChanges: "No staged changes",
      noUnstagedChanges: "No unstaged changes",
      invalidAiCommitMessage:
        "AI returned an invalid commit message. Try again or switch models.",
      committed: (shortSha, summary) => `Committed ${shortSha} ${summary}`,
      pushedTo: (upstream) => `Pushed to ${upstream}`,
      pushCompleted: "Push completed",
      unstagedFiles: (count) =>
        `${count} unstaged ${count === 1 ? "file" : "files"}`,
    },
    gitHistory: {
      unknownError: "Unknown error",
      loadingCommits: "Loading commits...",
      couldNotLoadHistory: "Could not load history",
      retry: "Retry",
      noCommitsYet: "No commits yet",
      branchHasNoCommits: "This branch has no commits.",
      sha: "SHA",
      subject: "Subject",
      author: "Author",
      date: "Date",
      changes: "Changes",
      loadingMore: "Loading more...",
      endOfHistory: "End of history",
      failedToLoadMore: "Failed to load more",
      noSubject: "(no subject)",
      unknown: "Unknown",
      filesChanged: (count) =>
        `${count} ${count === 1 ? "file" : "files"} changed`,
      copied: "Copied",
      copySha: "Copy SHA",
      loadingFiles: "Loading files...",
      noFileChanges: "No file changes.",
      files: "Files",
      binary: "binary",
    },
    editor: {
      newFileTitle: "New file",
      newFileDescription:
        "Filename (relative to workspace root). The extension determines the language mode.",
      nameRequired: "Name is required",
      pathMustBeRelative: "Path must be relative",
      noWorkspaceRoot: "No workspace root",
      cancel: "Cancel",
      create: "Create",
      loading: "Loading...",
      binaryFile: "Binary file",
      fileTooLarge: "File too large",
      previewNotSupported: "preview not supported",
      binaryPatchFallback: "Binary / patch fallback",
      largeFilePatchView: "Large file / patch view",
      loadingDiff: "Loading diff...",
      diffPreviewUnavailable: "Diff preview is not available for this file.",
      aiDiffStatus: {
        pending: "Pending review",
        approved: "Applied",
        rejected: "Rejected",
      },
      newFileBadge: "New file",
      saveToPreview: "Save to preview",
      accept: "Accept",
      reject: "Reject",
    },
    preview: {
      title: "Preview",
      xfoHint:
        "Many public sites refuse to embed (X-Frame-Options). If the page is blank, open it externally.",
      suspendedTitle: "Preview suspended",
      suspendedBody: "Released to free memory after sitting in the background.",
      reload: "Reload",
      emptyTitle: "Nothing to preview yet",
      emptyBodyPrefix: "Type a URL above, or open the",
      ports: "Ports",
      emptyBodySuffix:
        "dropdown to jump straight to your running dev server. Public sites often block embedding - open them in your browser via the link icon if you see a blank page.",
      enterUrlOrPort: "Enter a URL or pick a port preset.",
      noServerListening: (port) => `No server listening on :${port}.`,
      commonPorts: "Common dev-server ports",
      checking: "checking...",
      openInSystemBrowser: "Open in system browser",
      dismiss: "Dismiss",
    },
    markdown: {
      rendered: "Rendered",
      raw: "Raw",
      loading: "Loading...",
      readFailed: (message) => `Failed to read file: ${message}`,
      binaryCannotRender: "Binary file - cannot render as markdown.",
      fileTooLarge: (size, limit) => `File is ${size} bytes; limit ${limit}.`,
    },
  },
  ai: {
    chat: {
      emptyTitle: "Ask Kite anything",
      emptyDescription:
        "Explain command output, fix errors, generate snippets, or run a task.",
      thinking: "Thinking...",
      errorTitle: "Something went wrong.",
      dismiss: "Dismiss",
      contextCompacted: (count) =>
        `Context compacted - ${count} older tool ${count === 1 ? "result" : "results"} elided to save tokens.`,
      stepLimit: "Hit the step limit. Continue to keep going.",
      continue: "Continue",
      editorSelection: "Editor selection",
      terminalSelection: "Terminal selection",
      read: "Read",
      fileCount: (count) => `${count} file${count === 1 ? "" : "s"}`,
      openAiLog: "Open AI log",
      error: "Error",
      askKite: "Ask Kite",
      removeCommand: "Remove command",
      removeSnippet: "Remove snippet",
      linesShort: (count) => `${count}L`,
    },
    input: {
      connectProviderHint:
        "Connect any AI provider (or use local models) - your key stays in your OS keychain.",
      connectProvider: "Connect provider",
      placeholder:
        "Ask Kite anything   -   # for snippets and commands, @ for files",
      listening: "Listening...",
      transcribing: "Transcribing...",
      transcriptionFailed: "Transcription failed",
      microphoneAccessFailed: "Microphone access failed",
      openAiAgent: "Open AI agent",
      attachFileOrImage: "Attach file or image",
      voiceNeedsKey: (provider) => `Voice needs a ${provider} key`,
      stopAndTranscribe: "Stop & transcribe",
      voiceInput: "Voice input",
      closeAiPanel: "Close AI panel",
      miniWindowOpen: "Mini-window open",
      openConversation: "Open conversation",
      stop: "Stop",
      send: "Send",
      modelTitle: (model) => `Model: ${model}`,
      modelNoKey: (model) => `${model} - no key configured`,
      searchModels: "Search models, providers, capabilities...",
      all: "All",
      favorites: "Favorites",
      recent: "Recent",
      allProviders: "All providers",
      providerNotConfigured: (provider) => `${provider} - not configured`,
      noFavorites: "No favorites yet - star a model to pin it here.",
      noRecent: "No recently-used models.",
      noModelsMatch: "No models match.",
      configureProvider: (provider) =>
        `Configure ${provider} to use these models.`,
      open: "Open",
      favorite: "Favorite",
      unfavorite: "Unfavorite",
      intelligence: "Intelligence",
      speed: "Speed",
      affordability: "Affordability",
    },
    mini: {
      planMode: "Plan mode",
      queued: (count) => `${count} queued`,
      noEditsQueued: "no edits queued",
      exit: "Exit",
      loadingSessions: "Loading sessions...",
      close: "Close",
      closeEsc: "Close (Esc)",
      switchSession: "Switch session",
      newChat: "New chat",
      untitledSession: "New chat",
      newSession: "New session",
      deleteSession: "Delete session",
      emptyTitle: "Ask Kite anything",
      emptyDescription:
        "Kite sees the active terminal - cwd, recent commands, and output.",
      suggestions: {
        explainError: {
          label: "Explain the last error",
          hint: "Read the terminal buffer",
          text: "Explain the last error in the terminal.",
        },
        generateCommand: {
          label: "Generate a command",
          hint: "Tell me what you want to do",
          text: "Give me a command to ",
        },
        summarizeBuffer: {
          label: "Summarize buffer",
          hint: "Recap recent activity",
          text: "Summarize what just happened in the terminal.",
        },
      },
      context: {
        model: "Model",
        lastRequest: "Last request",
        estimatedContext: "Estimated context",
        ofWhichCached: "Of which cached",
        sessionInput: "Session input",
        sessionOutput: "Session output",
        cacheHit: "Cache hit",
        sessionCost: "Session cost",
        window: "Window",
        lastRequestNote:
          "Last request reflects current context size; session totals are cumulative.",
        approximateNote: "Token count is approximate (chars / 4).",
      },
    },
    approval: {
      needsApproval: "needs approval",
      deny: "Deny",
      approve: "Approve",
      reviewInDiffTab: "review in the diff tab",
      replaceAll: "replace all",
      lineCount: (count) => `${count} line${count === 1 ? "" : "s"}`,
      editCount: (count) => `${count} edit${count === 1 ? "" : "s"}`,
      tools: {
        write_file: "Write file",
        edit: "Edit file",
        multi_edit: "Edit file (batch)",
        create_directory: "Create directory",
        bash_run: "Run shell command",
        bash_background: "Spawn background process",
      },
    },
    planDiff: {
      title: "Plan review",
      pendingChange: (count) =>
        `${count} pending change${count === 1 ? "" : "s"}`,
      discardAll: "Discard all",
      apply: (count) => `Apply ${count}`,
      toggleDiff: "Toggle diff",
      new: "new",
      multiEdit: "multi-edit",
      createDirectory: "create directory",
      reject: "Reject",
      noLineLevelChanges: "no line-level changes",
      moreChanges: (count) => `${count} more changes`,
    },
    pickers: {
      workspaceFiles: "Workspace files",
      noWorkspaceOpen: "No workspace open",
      indexingWorkspace: "Indexing workspace...",
      noMatchingFiles: "No matching files",
      refineLargeWorkspace:
        "Workspace is large - refine your query to narrow results.",
      noSnippetMatches: "No matches. Add snippets in Settings -> Agents.",
      prebuiltSnippets: "Pre-built snippets",
      snippets: "Snippets",
    },
    slashCommands: {
      init: "Initialize workspace",
      plan: "Plan mode",
      "claude-code": "Delegate to Claude Code",
    },
    agentSwitcher: {
      agentTitle: (name) => `Agent: ${name}`,
      builtIn: "Built-in",
      custom: "Custom",
      manageAgents: "Manage agents...",
      builtInAgents: {
        "builtin:coder": {
          name: "Coder",
          description:
            "General-purpose coding assistant. Writes, edits, and runs.",
        },
        "builtin:architect": {
          name: "Architect",
          description: "Design and tradeoffs. Plans before code.",
        },
        "builtin:reviewer": {
          name: "Code Reviewer",
          description: "Reviews diffs for correctness, perf, security.",
        },
        "builtin:security": {
          name: "Security",
          description: "Threat-models changes and flags vulns.",
        },
        "builtin:designer": {
          name: "Designer",
          description: "UI/UX critique and refinement.",
        },
      },
    },
    todo: {
      title: "Todos",
    },
    notifications: {
      localAgent: "Kite",
      approvalTitle: "Kite needs your approval",
      approvalBody: "Approve a tool to continue",
      runFailedTitle: "Kite run failed",
      finishedTitle: "Kite finished",
      finishedBody: "Your task is ready",
      agentNeedsInput: (name) => `${name} needs your input`,
      agentFinished: (name) => `${name} finished`,
      waiting: "waiting",
      working: "working",
      labels: {
        attention: "needs input",
        finished: "finished",
        error: "failed",
      },
      enabled: "enabled",
      enabling: "Enabling",
      enable: "Enable",
      title: "Notifications",
      activeCount: (count) => `${count} active`,
      clear: "Clear",
      emptyLine1: "No agent activity yet.",
      emptyLine2: "Run the Kite agent or a coding agent to track it here.",
      agentAlerts: "Agent alerts",
      open: "Open",
      justNow: "just now",
      minutesAgo: (count) => `${count}m ago`,
      hoursAgo: (count) => `${count}h ago`,
      daysAgo: (count) => `${count}d ago`,
    },
    tool: {
      labels: {
        read_file: "Read",
        list_directory: "List",
        write_file: "Write",
        create_directory: "Create dir",
        edit: "Edit",
        multi_edit: "Edit",
        bash_run: "Run",
        bash_background: "Spawn",
        bash_logs: "Logs",
        bash_list: "Jobs",
        bash_kill: "Kill",
        grep: "Search",
        glob: "Glob",
        suggest_command: "Suggest",
        open_preview: "Preview",
        run_subagent: "Subagent",
        todo_write: "Todos",
      },
      status: {
        approvalRequested: "awaiting approval",
        approvalResponded: "responded",
        inputStreaming: "preparing",
        inputAvailable: "running",
        outputAvailable: "done",
        outputDenied: "denied",
        outputError: "error",
      },
      input: "Input",
      output: "Output",
      error: "Error",
      failed: "failed",
      itemCount: (count) => `${count} item${count === 1 ? "" : "s"}`,
      lineCount: (count) => `${count} line${count === 1 ? "" : "s"}`,
      empty: "empty",
      read: "read",
      noMatches: "no matches",
      filesScanned: (count) =>
        `${count} ${count === 1 ? "file" : "files"} scanned`,
      hitCount: (count) => `${count} hit${count === 1 ? "" : "s"}`,
      filesCount: (count) => `${count} ${count === 1 ? "file" : "files"}`,
      truncated: "truncated",
      replacementCount: (count) =>
        `${count} replacement${count === 1 ? "" : "s"}`,
      created: "created",
      wrote: "wrote",
      running: "running",
      timedOut: "timed out",
      cwdAfter: (cwd) => `cwd -> ${cwd}`,
      insertIntoActiveTerminal: "Insert into active terminal",
      inserted: "Inserted",
      insert: "Insert",
      generatingCode: "Generating code...",
      generating: (label) => `Generating ${label}...`,
      runInActiveTerminal: "Run in active terminal",
      sent: "Sent",
      run: "Run",
      copyCode: "Copy code",
      copy: "Copy",
      modelContextUsage: "Model context usage",
      previousBranch: "Previous branch",
      nextBranch: "Next branch",
      branchPage: (current, total) => `${current} of ${total}`,
      usageInput: "Input",
      usageOutput: "Output",
      usageReasoning: "Reasoning",
      usageCache: "Cache",
    },
    reasoning: {
      thinking: "Thinking",
      reasoned: "Reasoned",
      reasonedFor: (seconds) => `Reasoned for ${seconds}s`,
    },
  },
  settings: {
    tabs: {
      general: "General",
      themes: "Themes",
      shortcuts: "Shortcuts",
      models: "Models",
      agents: "Agents",
      about: "About",
    },
    general: {
      title: "General",
      description: "Mode, editor, and startup.",
      appearance: {
        title: "Appearance",
        system: "System",
        light: "Light",
        dark: "Dark",
        themesHint: "For theme, background and customization, see the",
        themesTab: "Themes",
        themesHintSuffix: "tab.",
      },
      language: {
        title: "Language",
        description:
          "Controls the app UI language. Terminal output, files, model names, and AI responses keep their original language.",
      },
      languageTitle: "Language",
      languageDescription:
        "Controls the app UI language. Terminal output, files, model names, and AI responses keep their original language.",
      zoom: {
        title: "Zoom",
        uiZoomLevel: "UI zoom level",
      },
      editor: {
        title: "Editor",
        vimMode: "Vim mode",
        vimModeDescription: "Enable Vim keybindings in the code editor.",
        wordWrap: "Word wrap",
        wordWrapDescription:
          "Wrap long lines instead of scrolling horizontally.",
        autoSave: "Auto save",
        autoSaveDescription:
          "Automatically save files after a delay when changes are detected.",
        autoSaveDelay: "Auto save delay",
        autoSaveDelayDescription:
          "Delay before unsaved changes are saved automatically.",
      },
      explorer: {
        title: "Explorer",
        showHiddenFiles: "Show hidden files",
        showHiddenFilesDescription:
          "Include dot-prefixed files and folders (.env, .gitignore, .config) in the file explorer and search.",
        gitDecorations: "Git decorations",
        gitDecorationsDescription:
          "Tint changed files and dim gitignored entries in the file explorer.",
      },
      terminal: {
        title: "Terminal",
        useWebgl: "Use WebGL renderer",
        webglAria: "More info about WebGL renderer",
        webglTooltip:
          "xterm's WebGL renderer caches glyphs in a GPU texture atlas. On some macOS setups, the atlas corrupts and terminal text becomes unreadable. Turn this off as a fallback. CJK font fallback may also produce artifacts under WebGL.",
        webglDescription:
          "Hardware-accelerated rendering. Turn off if text shows corruption, blank tiles, or CJK misalignment.",
        fontFamily: "Font family",
        fontFamilyPlaceholder:
          "e.g. JetBrains Mono, 'Microsoft YaHei', monospace",
        fontWeight: "Font weight",
        fontWeightDescription: "Thickness of terminal characters.",
        fontWeights: {
          normal: "Normal",
          medium: "Medium",
          semiBold: "Semi-Bold",
          bold: "Bold",
        },
        shell: "Integrated terminal shell",
        shellUnavailableDescription:
          "Command blocks and directory tracking are unavailable for this shell.",
        shellWithWslDescription:
          "Shell for the integrated terminal. WSL spaces use the distro login shell. Existing tabs keep their shell.",
        shellDescription:
          "Shell for new terminal tabs. Existing tabs keep their shell.",
        autoShell: "Auto",
        workspaceEnvironment: "Workspace environment",
        workspaceEnvironmentDescription:
          "Where new spaces run, terminal and AI agent alike: Windows or a WSL distro. Existing spaces keep theirs; switch any from the status bar.",
        unavailable: "unavailable",
        letterSpacing: "Letter spacing",
        letterSpacingDescription:
          "Extra horizontal space between characters (px). Use negative values to tighten Nerd Fonts.",
        fontSize: "Font size",
        fontSizeDescription: "Terminal text size.",
        scrollback: "Scrollback",
        scrollbackDescription:
          "Lines of history kept per terminal. Higher uses more RAM (~3 KB / line).",
        scrollbackLines: (lines) => `${lines} lines`,
      },
      agents: {
        title: "Agents",
        notifications: "Coding agent notifications",
        notificationsDescription:
          "Alert when Claude Code or Codex running in a terminal needs your input or finishes. Desktop notification when Kite is unfocused, in-app otherwise.",
      },
      startup: {
        title: "Startup",
        launchAtLogin: "Launch at login",
        launchAtLoginDescription: "Open Kite automatically when you sign in.",
        restoreWindow: "Restore window position & size",
        restoreWindowDescription:
          "Reopen the main window where you left it. Applies on next launch.",
      },
    },
    themes: {
      title: "Themes",
      description: "Theme, background image, and customization.",
      theme: {
        title: "Theme",
        create: "Create",
        importTheme: "Import .kite-theme",
        failedToRead: "failed to read",
        editTheme: (name) => `Edit ${name}`,
        removeTheme: (name) => `Remove ${name}`,
      },
      editorTheme: {
        title: "Editor theme",
        description:
          "Syntax colors for the code editor. Auto follows the app theme.",
        auto: "Auto (match app theme)",
      },
      background: {
        title: "Background",
        remove: "Remove",
        replaceImage: "Replace image",
        chooseImage: "Choose image",
        notImage: "not an image",
        failedToImportImage: "failed to import image",
        opacity: "Opacity",
        blur: "Blur",
        emptyHint:
          "Drop an image here or pick one. Stored locally; doesn't affect the default look until set.",
      },
    },
    shortcuts: {
      title: "Shortcuts",
      description: "View and customize keyboard shortcuts.",
      resetAll: "Reset All",
      searchPlaceholder: "Search shortcuts...",
      unassigned: "Unassigned",
      resetToDefault: "Reset to default",
      clearShortcut: "Clear shortcut",
      recording: "Recording...",
      escToCancel: "(Esc to cancel)",
      resetDialogTitle: "Reset all shortcuts?",
      resetDialogDescription:
        "This will revert all your custom keyboard shortcuts to their factory defaults. This action cannot be undone.",
      groups: {
        General: "General",
        Tabs: "Tabs",
        Spaces: "Spaces",
        Panes: "Panes",
        Terminal: "Terminal",
        Search: "Search",
        AI: "AI",
        View: "View",
        Editor: "Editor",
      },
      actions: {
        "commandPalette.open": "Open command palette",
        "commandPalette.content": "Find in files",
        "settings.open": "Open settings",
        "tab.new": "New tab",
        "tab.newBlock": "New Blocks terminal",
        "tab.newPrivate": "New private terminal",
        "tab.newPreview": "New web preview",
        "tab.newEditor": "New editor tab",
        "tab.close": "Close tab or pane",
        "pane.splitRight": "Split pane right",
        "pane.splitDown": "Split pane down",
        "pane.focusNext": "Focus next pane",
        "pane.focusPrev": "Focus previous pane",
        "pane.source": "Toggle source panel",
        "terminal.clear": "Clear terminal",
        "terminal.toggleInput": "Toggle Shell / AI input",
        "blocks.prev": "Previous command block",
        "blocks.next": "Next command block",
        "tab.next": "Next tab",
        "tab.prev": "Previous tab",
        "tab.selectByIndex": "Jump to tab 1-9",
        "space.next": "Next space",
        "space.prev": "Previous space",
        "space.overview": "Open spaces",
        "explorer.search": "Search files",
        "search.focus": "Find in terminal",
        "ai.toggle": "Toggle AI agent",
        "ai.askSelection": "Ask AI about selection",
        "agent.focusAttention": "Jump to agent needing attention",
        "sidebar.toggle": "Toggle file explorer",
        "explorer.focus": "Toggle file explorer focus",
        "view.zoomIn": "Zoom in",
        "view.zoomOut": "Zoom out",
        "view.zoomReset": "Reset zoom",
        "view.zenMode": "Toggle zen mode",
        "editor.undo": "Undo",
        "editor.redo": "Redo",
      },
    },
    models: {
      title: "Models",
      description:
        "Connect the providers you use. Keys live in your OS keychain and are used only by Kite.",
      defaults: "Defaults",
      chatModel: "Chat model",
      autocomplete: "Autocomplete",
      providers: {
        title: "Providers",
        add: "Add provider",
        cloud: "Cloud",
        localAndCustom: "Local & custom",
        emptyTitle: "No providers connected yet.",
        emptyDescription:
          'Click "Add provider" to connect a cloud or local model source.',
        removeProvider: "Remove provider",
        removeEndpoint: "Remove endpoint",
        removeKey: "Remove key",
        connected: "Connected",
        notConnected: "not connected",
        needsConnection: (provider) =>
          `${provider} isn't connected - add it below.`,
      },
      fields: {
        name: "Name",
        baseUrl: "Base URL",
        modelId: "Model ID",
        context: "Context",
        tokens: "tokens",
        apiKey: "API key",
        provider: "Provider",
        model: "Model",
      },
      localMeta: {
        lmstudio: {
          description:
            "Run GGUF models via LM Studio's HTTP server (Developer tab -> enable).",
          modelHintBefore: "The model id loaded in LM Studio, see the server's",
          modelHintCode: "/v1/models",
          modelHintAfter: "page.",
        },
        mlx: {
          description:
            "Apple-silicon inference via mlx_lm.server (pip install mlx-lm).",
          modelHintBefore:
            "The Hugging Face repo path you launched mlx_lm.server with.",
        },
        ollama: {
          description:
            "Local models via Ollama's built-in OpenAI-compatible API.",
          modelHintBefore: "The model name from `ollama list` / `ollama pull`.",
        },
        "openai-compatible": {
          description:
            "Any OpenAI-compatible endpoint: vLLM, Z.AI, Fireworks, etc.",
        },
        openrouter: {
          description:
            "Any model on OpenRouter, type its full provider/model id.",
          modelHintBefore: "Browse ids at",
          modelHintCode: "openrouter.ai/models",
          modelHintAfter: ".",
        },
      },
      localProvider: {
        docs: "Docs",
        test: "Test",
        optionalApiKeyPlaceholder:
          "Optional, leave empty for unauthenticated endpoints",
        save: "Save",
        testing: "Testing...",
        reachable: "Reachable - server responded.",
        unreachable: "Could not reach the server.",
        myEndpointPlaceholder: "My endpoint",
      },
      voice: {
        title: "Voice input",
        openaiDescription:
          "Uses your official OpenAI API key and the Whisper model for transcription.",
        groqDescription:
          "Uses your official Groq API key and Groq's Whisper endpoint for transcription.",
        whispercppDescription:
          "Connects to a local Whisper.cpp server for fully offline transcription.",
      },
      providerKeyCard: {
        enterKey: "Enter your API key.",
        keyPrefixError: (provider, prefix) =>
          `${provider} keys start with "${prefix}".`,
        failedToSave: (error) => `Failed to save: ${error}`,
        getKey: "Get key",
        removeProvider: "Remove provider",
        pasteApiKey: "Paste API key",
        showKey: "Show key",
        hideKey: "Hide key",
        replace: "Replace",
        remove: "Remove",
      },
    },
    agents: {
      title: "Agents",
      description:
        "Personas and snippets the AI uses. Switch agents from the input bar.",
      customInstructions: {
        title: "Custom instructions",
        placeholder:
          "e.g. Always reply in concise bullet points. Prefer pnpm over npm. My machine is an M-series Mac.",
      },
      agents: {
        title: "Agents",
        new: "New agent",
        newDefaultName: "New agent",
        builtIn: "Built-in",
        active: "Active",
        useAgent: "Use agent",
        edit: "Edit",
        delete: "Delete",
        dialogNewTitle: "New agent",
        dialogEditTitle: "Edit agent",
        icon: "Icon",
        name: "Name",
        namePlaceholder: "e.g. Test Engineer",
        description: "Description",
        descriptionPlaceholder: "One line, shown in the agent picker",
        instructions: "Instructions",
        instructionsPlaceholder:
          "Persona & rules. Appended to Kite's core system prompt.",
      },
      snippets: {
        title: "Snippets",
        descriptionPrefix:
          "Reusable instructions you can drop into any prompt with",
        descriptionSuffix: ".",
        new: "New snippet",
        emptyPrefix: "No snippets yet. Create one and insert it with",
        emptySuffix: "in the AI input.",
        edit: "Edit",
        delete: "Delete",
        dialogNewTitle: "New snippet",
        dialogEditTitle: "Edit snippet",
        handle: "Handle",
        name: "Name",
        description: "Description",
        content: "Content",
        handlePlaceholder: "review",
        namePlaceholder: "e.g. Pre-merge review checklist",
        descriptionPlaceholder: "One line, shown in the # picker",
        contentPlaceholder:
          "Inserted into the prompt as a <snippet> block when you use #handle.",
        handleRequired: "Required.",
        handleInvalid: "Lowercase letters, digits, and dashes only.",
        handleInUse: "Already in use.",
      },
    },
    about: {
      title: "About",
      tagline: "Open-source AI-native terminal emulator",
      build: "Build",
      bundleId: "Bundle ID",
      license: "License",
      sourceCode: "Source code",
      projectPage: "Project page",
      updatesDisabled: "Updates disabled",
      updateChecksDisabled:
        "Update checks are disabled for this personal fork.",
      actions: {
        viewOnGitHub: "View on GitHub",
        reportIssue: "Report an issue",
      },
    },
  },
};
