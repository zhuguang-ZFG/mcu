// 本站两类工具链语法的最小 TextMate 规则；不依赖把未知语言静默当 txt。
export const codeLanguages = [
  {
    name: 'ld', scopeName: 'source.ld', aliases: ['linker-script'],
    patterns: [
      { name: 'comment.block.ld', begin: '/\\*', end: '\\*/' },
      { name: 'comment.line.ld', match: '#.*$' },
      { name: 'string.quoted.double.ld', begin: '"', end: '"' },
      { name: 'constant.numeric.ld', match: '\\b(?:0[xX][0-9a-fA-F]+|[0-9]+[KkMm]?)\\b' },
      { name: 'keyword.control.ld', match: '\\b(?:MEMORY|SECTIONS|ENTRY|KEEP|AT|LOADADDR|ADDR|SIZEOF|ALIGN|ORIGIN|LENGTH|PROVIDE|ASSERT|NOLOAD|SORT|EXCLUDE_FILE|OUTPUT_FORMAT|OUTPUT_ARCH)\\b' },
      { name: 'entity.name.section.ld', match: '\\.[A-Za-z_][A-Za-z_0-9.]*' },
    ],
  },
  {
    name: 'gdb', scopeName: 'source.gdb',
    patterns: [
      { name: 'comment.line.gdb', match: '#.*$' },
      { name: 'string.quoted.double.gdb', begin: '"', end: '"' },
      { name: 'variable.other.gdb', match: '\\$[A-Za-z_][A-Za-z_0-9]*' },
      { name: 'constant.numeric.gdb', match: '\\b(?:0[xX][0-9a-fA-F]+|[0-9]+)\\b' },
      { name: 'keyword.control.gdb', match: '\\b(?:target|remote|monitor|reset|halt|load|break|b|continue|c|step|s|next|n|print|p|x|info|set|watch|layout|disassemble|file|run|quit|bt)\\b' },
    ],
  },
]
