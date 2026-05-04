import "server-only";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

type InlineToken = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

// Parse simple inline markdown: **bold**, *italic*, `code`
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const bold = remaining.match(/^\*\*(.+?)\*\*/);
    const italic = remaining.match(/^\*(.+?)\*/);
    const code = remaining.match(/^`(.+?)`/);

    if (bold) {
      tokens.push({ text: bold[1], bold: true });
      remaining = remaining.slice(bold[0].length);
      continue;
    }
    if (italic) {
      tokens.push({ text: italic[1], italic: true });
      remaining = remaining.slice(italic[0].length);
      continue;
    }
    if (code) {
      tokens.push({ text: code[1], code: true });
      remaining = remaining.slice(code[0].length);
      continue;
    }

    // Take next character that isn't a special marker, then look for next marker
    const nextSpecial = remaining.search(/(\*\*|\*|`)/);
    if (nextSpecial === -1) {
      tokens.push({ text: remaining });
      break;
    }
    if (nextSpecial > 0) {
      tokens.push({ text: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
    } else {
      tokens.push({ text: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

function tokensToRuns(tokens: InlineToken[]): TextRun[] {
  return tokens.map(
    (t) =>
      new TextRun({
        text: t.text,
        bold: t.bold,
        italics: t.italic,
        font: t.code ? "Consolas" : undefined,
      })
  );
}

function inlineToRuns(text: string): TextRun[] {
  return tokensToRuns(parseInline(text));
}

function parseTable(lines: string[], startIdx: number): { table: Table; nextIdx: number } | null {
  // Markdown table: | col1 | col2 | ... \n |---|---| \n |val|val|
  const headerLine = lines[startIdx];
  const sepLine = lines[startIdx + 1];
  if (!headerLine?.startsWith("|") || !sepLine?.match(/^\|\s*-+/)) return null;

  const splitRow = (line: string) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headers = splitRow(headerLine);
  const rows: string[][] = [];

  let i = startIdx + 2;
  while (i < lines.length && lines[i].startsWith("|")) {
    rows.push(splitRow(lines[i]));
    i += 1;
  }

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ children: inlineToRuns(h) })],
            shading: { fill: "F0F0F0" },
          })
      ),
    }),
    ...rows.map(
      (r) =>
        new TableRow({
          children: r.map(
            (c) =>
              new TableCell({
                children: [new Paragraph({ children: inlineToRuns(c) })],
              })
          ),
        })
    ),
  ];

  const table = new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
    },
  });

  return { table, nextIdx: i };
}

function lineToParagraph(line: string): Paragraph {
  const h1 = /^#\s+(.+)$/.exec(line);
  if (h1) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: inlineToRuns(h1[1]),
      spacing: { before: 200, after: 200 },
    });
  }
  const h2 = /^##\s+(.+)$/.exec(line);
  if (h2) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: inlineToRuns(h2[1]),
      spacing: { before: 240, after: 120 },
    });
  }
  const h3 = /^###\s+(.+)$/.exec(line);
  if (h3) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: inlineToRuns(h3[1]),
    });
  }
  const bullet = /^[-*]\s+(.+)$/.exec(line);
  if (bullet) {
    return new Paragraph({
      children: inlineToRuns(bullet[1]),
      bullet: { level: 0 },
    });
  }
  const numbered = /^\d+\.\s+(.+)$/.exec(line);
  if (numbered) {
    return new Paragraph({
      children: inlineToRuns(numbered[1]),
      numbering: { reference: "default-numbering", level: 0 },
    });
  }
  if (line.trim() === "") {
    return new Paragraph({});
  }
  return new Paragraph({
    children: inlineToRuns(line),
    spacing: { after: 100 },
  });
}

function markdownToBlocks(content: string): (Paragraph | Table)[] {
  const lines = content.split(/\r?\n/);
  const blocks: (Paragraph | Table)[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for table start
    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1].match(/^\|\s*-+/)) {
      const t = parseTable(lines, i);
      if (t) {
        blocks.push(t.table);
        // Empty paragraph for spacing after table
        blocks.push(new Paragraph({}));
        i = t.nextIdx - 1;
        continue;
      }
    }

    blocks.push(lineToParagraph(line));
  }

  return blocks;
}

export async function reportToDocxBuffer(
  title: string,
  meta: { generatedAt: string; focus?: string | null },
  content: string
): Promise<Buffer> {
  const titleParagraph = new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 36 })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 200 },
  });

  const metaParagraph = new Paragraph({
    children: [
      new TextRun({
        text: `Generated: ${meta.generatedAt}${meta.focus ? ` · Focus: ${meta.focus}` : ""}`,
        color: "888888",
        size: 18,
      }),
    ],
    spacing: { after: 400 },
  });

  const blocks = markdownToBlocks(content);

  const doc = new Document({
    creator: "Loamia",
    title,
    description: "Loamia Auto Report",
    styles: {
      default: {
        document: {
          run: {
            font: "Microsoft JhengHei",
            size: 22,
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [titleParagraph, metaParagraph, ...blocks],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
