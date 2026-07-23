import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const ALLOWED_DUPLICATE_CHANNELS = new Set(["check-app-name"]);

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char ?? "");
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char ?? "");
}

function canStartRegex(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  const previous = source[cursor];
  return "([{:;,=!?&|+-*%^~<>".includes(previous);
}

export function maskCommentsAndStrings(source) {
  const output = source.split("");
  let index = 0;
  let state = "code";
  let quote = "";
  let regexCharacterClass = false;

  const mask = (position) => {
    if (output[position] !== "\n" && output[position] !== "\r") {
      output[position] = " ";
    }
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        mask(index);
        mask(index + 1);
        index += 2;
        state = "line-comment";
        continue;
      }
      if (char === "/" && next === "*") {
        mask(index);
        mask(index + 1);
        index += 2;
        state = "block-comment";
        continue;
      }
      if (char === "/" && canStartRegex(source, index)) {
        regexCharacterClass = false;
        mask(index);
        index += 1;
        state = "regex";
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        mask(index);
        index += 1;
        state = "string";
        continue;
      }
      index += 1;
      continue;
    }

    if (state === "line-comment") {
      mask(index);
      index += 1;
      if (char === "\n") state = "code";
      continue;
    }

    if (state === "block-comment") {
      mask(index);
      if (char === "*" && next === "/") {
        mask(index + 1);
        index += 2;
        state = "code";
      } else {
        index += 1;
      }
      continue;
    }

    if (state === "regex") {
      mask(index);
      if (char === "\\") {
        if (index + 1 < source.length) mask(index + 1);
        index += 2;
        continue;
      }
      if (char === "[") regexCharacterClass = true;
      if (char === "]") regexCharacterClass = false;
      index += 1;
      if (char === "/" && !regexCharacterClass) {
        while (/[A-Za-z]/.test(source[index] ?? "")) {
          mask(index);
          index += 1;
        }
        state = "code";
      }
      continue;
    }

    mask(index);
    if (char === "\\") {
      if (index + 1 < source.length) mask(index + 1);
      index += 2;
      continue;
    }
    index += 1;
    if (char === quote) state = "code";
  }

  return output.join("");
}

export function findMatchingDelimiter(source, openingIndex, opening, closing) {
  let depth = 0;
  let state = "code";
  let quote = "";
  let regexCharacterClass = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line-comment";
        index += 1;
        continue;
      }
      if (char === "/" && next === "*") {
        state = "block-comment";
        index += 1;
        continue;
      }
      if (char === "/" && canStartRegex(source, index)) {
        state = "regex";
        regexCharacterClass = false;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        state = "string";
        quote = char;
        continue;
      }
      if (char === opening) depth += 1;
      if (char === closing) {
        depth -= 1;
        if (depth === 0) return index;
      }
      continue;
    }

    if (state === "line-comment") {
      if (char === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "regex") {
      if (char === "\\") {
        index += 1;
        continue;
      }
      if (char === "[") regexCharacterClass = true;
      if (char === "]") regexCharacterClass = false;
      if (char === "/" && !regexCharacterClass) state = "code";
      continue;
    }
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === quote) state = "code";
  }

  return -1;
}

function readIdentifier(source, start) {
  if (!isIdentifierStart(source[start])) return null;
  let end = start + 1;
  while (isIdentifierPart(source[end])) end += 1;
  return { value: source.slice(start, end), end };
}

function skipWhitespace(source, start) {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index += 1;
  return index;
}

export function extractNamedObject(source, variableName) {
  const code = maskCommentsAndStrings(source);
  const pattern = new RegExp(`\\b(?:export\\s+)?const\\s+${variableName}\\s*=\\s*\\{`, "m");
  const match = pattern.exec(code);
  if (!match) return null;
  const openingIndex = code.indexOf("{", match.index);
  const closingIndex = findMatchingDelimiter(source, openingIndex, "{", "}");
  if (closingIndex < 0) {
    throw new Error(`Unable to parse object ${variableName}`);
  }
  return {
    start: openingIndex,
    end: closingIndex,
    source: source.slice(openingIndex + 1, closingIndex),
  };
}

export function collectRegistryGroupNames(source) {
  const object = extractNamedObject(source, "ipcContractGroups");
  if (!object) throw new Error("ipcContractGroups was not found");
  const code = maskCommentsAndStrings(object.source);
  const names = [];
  let index = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  while (index < code.length) {
    const char = code[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth -= 1;

    if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      const identifier = readIdentifier(code, index);
      if (identifier) {
        let cursor = skipWhitespace(code, identifier.end);
        if (code[cursor] === "," || cursor >= code.length) {
          names.push(identifier.value);
          index = identifier.end;
          continue;
        }
        if (code[cursor] === ":") {
          cursor = skipWhitespace(code, cursor + 1);
          const valueIdentifier = readIdentifier(code, cursor);
          if (!valueIdentifier) {
            throw new Error(
              `IPC contract registry entry ${identifier.value} must reference a contract group identifier`,
            );
          }
          names.push(valueIdentifier.value);
          index = valueIdentifier.end;
          continue;
        }
        index = identifier.end;
        continue;
      }
    }
    index += 1;
  }

  return [...new Set(names)];
}

function collectTopLevelContractEntries(groupSource, groupName, filePath) {
  const code = maskCommentsAndStrings(groupSource);
  const entries = [];
  let index = 0;
  let braceDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  while (index < code.length) {
    const char = code[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth -= 1;
    else if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth -= 1;

    if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
      const identifier = readIdentifier(code, index);
      if (identifier) {
        let cursor = skipWhitespace(code, identifier.end);
        if (code[cursor] === ":") {
          cursor = skipWhitespace(code, cursor + 1);
          if (code.startsWith("defineContract", cursor)) {
            const openingParen = code.indexOf("(", cursor + "defineContract".length);
            const closingParen = findMatchingDelimiter(
              groupSource,
              openingParen,
              "(",
              ")",
            );
            if (openingParen < 0 || closingParen < 0) {
              throw new Error(
                `Unable to parse ${groupName}.${identifier.value} in ${filePath}`,
              );
            }
            const callSource = groupSource.slice(openingParen + 1, closingParen);
            const channelMatch = /\bchannel\s*:\s*(["'])([^"']+)\1/.exec(callSource);
            if (!channelMatch) {
              throw new Error(
                `Missing literal channel for ${groupName}.${identifier.value} in ${filePath}`,
              );
            }
            entries.push({
              group: groupName,
              member: identifier.value,
              channel: channelMatch[2],
              filePath,
            });
            index = closingParen + 1;
            continue;
          }
        }
        index = identifier.end;
        continue;
      }
    }
    index += 1;
  }

  return entries;
}

export function collectContractDefinitions(source, groupName, filePath = "source.ts") {
  const object = extractNamedObject(source, groupName);
  if (!object) return [];
  return collectTopLevelContractEntries(object.source, groupName, filePath);
}

function walkFiles(root, predicate) {
  if (!fs.existsSync(root)) return [];
  const results = [];
  const visit = (current) => {
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) visit(path.join(current, entry));
      return;
    }
    if (predicate(current)) results.push(current);
  };
  visit(root);
  return results;
}

function isTypeScriptSource(filePath) {
  return /\.(?:ts|tsx|mts|cts)$/.test(filePath);
}

function isExcludedRegistrationSource(root, filePath) {
  const relative = path.relative(root, filePath).replaceAll("\\", "/");
  return (
    relative.startsWith("src/ipc/types/") ||
    relative.startsWith("src/ipc/contracts/") ||
    relative.includes("/__tests__/") ||
    /\.(?:test|spec)\.(?:ts|tsx|mts|cts)$/.test(relative) ||
    relative.endsWith(".d.ts")
  );
}

function scriptKindFor(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".mts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".cts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.TS;
}

export function collectLiteralHandlerChannels(
  source,
  filePath = "source.ts",
) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  const handlerAliases = new Set();

  const collectAliases = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      (node.initializer.expression.text === "createLoggedHandler" ||
        node.initializer.expression.text === "createTestOnlyLoggedHandler")
    ) {
      handlerAliases.add(node.name.text);
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(sourceFile);

  const channels = new Set();
  const collectCalls = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression;
      const isRegisteredAlias =
        ts.isIdentifier(callee) && handlerAliases.has(callee.text);
      const isDirectIpcMainHandle =
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "handle" &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "ipcMain";
      const firstArgument = node.arguments[0];
      if (
        (isRegisteredAlias || isDirectIpcMainHandle) &&
        ts.isStringLiteralLike(firstArgument)
      ) {
        channels.add(firstArgument.text);
      }
    }
    ts.forEachChild(node, collectCalls);
  };
  collectCalls(sourceFile);
  return channels;
}

function collectRegisterTypedHandlerGroups(code) {
  const groups = new Set();
  const pattern = /\bregisterTypedHandlers\s*\(/g;
  for (const match of code.matchAll(pattern)) {
    const openingParen = code.indexOf("(", match.index);
    const closingParen = findMatchingDelimiter(code, openingParen, "(", ")");
    if (openingParen < 0 || closingParen < 0) continue;
    const argumentsSource = code.slice(openingParen + 1, closingParen);
    const argumentsList = [];
    let start = 0;
    let braces = 0;
    let parens = 0;
    let brackets = 0;
    for (let index = 0; index <= argumentsSource.length; index += 1) {
      const char = argumentsSource[index];
      if (char === "{") braces += 1;
      else if (char === "}") braces -= 1;
      else if (char === "(") parens += 1;
      else if (char === ")") parens -= 1;
      else if (char === "[") brackets += 1;
      else if (char === "]") brackets -= 1;
      if (
        (char === "," || index === argumentsSource.length) &&
        braces === 0 &&
        parens === 0 &&
        brackets === 0
      ) {
        argumentsList.push(argumentsSource.slice(start, index).trim());
        start = index + 1;
      }
    }
    const contractsArgument = argumentsList[1];
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(contractsArgument ?? "")) {
      groups.add(contractsArgument);
    }
  }
  return groups;
}

export function collectContractMemberReferences(
  source,
  groupNames,
  filePath = "source.ts",
) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(filePath),
  );
  const references = new Set();

  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      groupNames.has(node.expression.text)
    ) {
      references.add(
        `${node.expression.text}.${node.name.text}`,
      );
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
}

export function collectRegisteredContractReferences(
  sources,
  definitionsByGroup,
) {
  const references = new Set();
  const definitionsByChannel = new Map();
  for (const definitions of definitionsByGroup.values()) {
    for (const definition of definitions) {
      const channelDefinitions =
        definitionsByChannel.get(definition.channel) ?? [];
      channelDefinitions.push(definition);
      definitionsByChannel.set(definition.channel, channelDefinitions);
    }
  }

  for (const { source, filePath = "source.ts" } of sources) {
    const code = maskCommentsAndStrings(source);
    const wholeGroups = collectRegisterTypedHandlerGroups(code);
    const literalChannels = collectLiteralHandlerChannels(source, filePath);
    const memberReferences = collectContractMemberReferences(
      source,
      new Set(definitionsByGroup.keys()),
      filePath,
    );
    for (const reference of memberReferences) {
      references.add(reference);
    }
    for (const channel of literalChannels) {
      for (const definition of definitionsByChannel.get(channel) ?? []) {
        references.add(`${definition.group}.${definition.member}`);
      }
    }
    for (const [groupName, definitions] of definitionsByGroup) {
      if (wholeGroups.has(groupName)) {
        for (const definition of definitions) {
          references.add(`${groupName}.${definition.member}`);
        }
      }
    }
  }
  return references;
}

export function auditDefinitions(definitions, registeredReferences) {
  const missing = definitions.filter(
    (definition) =>
      !registeredReferences.has(`${definition.group}.${definition.member}`),
  );
  const channelOwners = new Map();
  const duplicateChannels = [];
  for (const definition of definitions) {
    const previous = channelOwners.get(definition.channel);
    if (
      previous &&
      !ALLOWED_DUPLICATE_CHANNELS.has(definition.channel)
    ) {
      duplicateChannels.push({
        channel: definition.channel,
        contracts: [previous, `${definition.group}.${definition.member}`],
      });
    } else {
      channelOwners.set(
        definition.channel,
        `${definition.group}.${definition.member}`,
      );
    }
  }
  return { missing, duplicateChannels };
}

export function runAudit(root = DEFAULT_ROOT) {
  const registryPath = path.join(root, "src/ipc/contracts/registry.ts");
  const registrySource = fs.readFileSync(registryPath, "utf8");
  const groupNames = collectRegistryGroupNames(registrySource);
  if (groupNames.length === 0) {
    throw new Error("The IPC contract registry is empty");
  }

  const typeFiles = walkFiles(path.join(root, "src/ipc/types"), isTypeScriptSource);
  const definitionsByGroup = new Map();
  const definitions = [];
  for (const groupName of groupNames) {
    const groupDefinitions = typeFiles.flatMap((filePath) =>
      collectContractDefinitions(
        fs.readFileSync(filePath, "utf8"),
        groupName,
        path.relative(root, filePath).replaceAll("\\", "/"),
      ),
    );
    if (groupDefinitions.length === 0) {
      throw new Error(`No defineContract entries found for ${groupName}`);
    }
    definitionsByGroup.set(groupName, groupDefinitions);
    definitions.push(...groupDefinitions);
  }

  const registrationFiles = walkFiles(path.join(root, "src"), isTypeScriptSource)
    .filter((filePath) => !isExcludedRegistrationSource(root, filePath))
    .map((filePath) => ({
      filePath,
      source: fs.readFileSync(filePath, "utf8"),
    }));
  const registeredReferences = collectRegisteredContractReferences(
    registrationFiles,
    definitionsByGroup,
  );
  const audit = auditDefinitions(definitions, registeredReferences);

  if (audit.duplicateChannels.length > 0 || audit.missing.length > 0) {
    const sections = [];
    if (audit.missing.length > 0) {
      sections.push(
        `Missing typed IPC handler references:\n${audit.missing
          .map(
            (item) =>
              `  - ${item.group}.${item.member} (${item.channel}) defined in ${item.filePath}`,
          )
          .join("\n")}`,
      );
    }
    if (audit.duplicateChannels.length > 0) {
      sections.push(
        `Duplicate IPC channels:\n${audit.duplicateChannels
          .map(
            (item) =>
              `  - ${item.channel}: ${item.contracts.join(" and ")}`,
          )
          .join("\n")}`,
      );
    }
    throw new Error(`IPC registration audit failed.\n\n${sections.join("\n\n")}`);
  }

  return {
    groupCount: groupNames.length,
    contractCount: definitions.length,
    registeredCount: registeredReferences.size,
  };
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    const result = runAudit(DEFAULT_ROOT);
    console.log(
      `IPC registration audit passed: ${result.contractCount} contracts across ${result.groupCount} groups.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
