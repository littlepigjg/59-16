class ModelParser {
  constructor() {
    this.validTypes = ['string', 'number', 'boolean', 'date', 'enum', 'reference'];
    this.validFormats = [
      'chineseName', 'englishName', 'email', 'phone', 'idCard',
      'address', 'company', 'title', 'sentence', 'paragraph',
      'url', 'ip', 'uuid', 'custom',
      'imageJpeg', 'imageJpg', 'imagePng', 'imageGif', 'imageBmp', 'imageWebp', 'imageSvg',
      'pdf', 'applicationPdf',
      'zip', 'applicationZip', 'gzip',
      'audioMp3', 'audioWav',
      'videoMp4',
      'doc', 'docx', 'xls', 'xlsx',
      'binary', 'rawBinary'
    ];
    this.binaryFormats = new Set([
      'imageJpeg', 'imageJpg', 'imagePng', 'imageGif', 'imageBmp', 'imageWebp', 'imageSvg',
      'pdf', 'applicationPdf',
      'zip', 'applicationZip', 'gzip',
      'audioMp3', 'audioWav',
      'videoMp4',
      'doc', 'docx', 'xls', 'xlsx',
      'binary', 'rawBinary'
    ]);
  }

  parse(model) {
    if (!model || typeof model !== 'object') {
      throw new Error('模型必须是一个对象');
    }

    if (!model.name || typeof model.name !== 'string') {
      throw new Error('模型必须包含 name 字段');
    }

    if (!Array.isArray(model.fields)) {
      throw new Error('模型必须包含 fields 数组');
    }

    if (model.fields.length === 0) {
      throw new Error('模型至少需要一个字段');
    }

    const parsedFields = model.fields.map((field, index) => {
      return this.parseField(field, index);
    });

    const fieldNames = parsedFields.map(f => f.name);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      throw new Error(`存在重复的字段名: ${duplicates.join(', ')}`);
    }

    return {
      name: model.name,
      fields: parsedFields
    };
  }

  parseField(field, index) {
    if (!field || typeof field !== 'object') {
      throw new Error(`第 ${index + 1} 个字段必须是对象`);
    }

    if (!field.name || typeof field.name !== 'string') {
      throw new Error(`第 ${index + 1} 个字段必须包含 name 属性`);
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
      throw new Error(`字段名 ${field.name} 格式不正确，只能包含字母、数字和下划线，且不能以数字开头`);
    }

    if (!field.type || !this.validTypes.includes(field.type)) {
      throw new Error(`字段 ${field.name} 的类型必须是: ${this.validTypes.join(', ')}`);
    }

    const rule = this.parseRule(field.rule || {}, field.type, field.name);

    return {
      name: field.name,
      type: field.type,
      label: field.label || field.name,
      rule: rule,
      nullable: field.nullable || false,
      nullProbability: field.nullProbability || 0
    };
  }

  parseRule(rule, type, fieldName) {
    const parsedRule = { ...rule };

    switch (type) {
      case 'string':
        return this.parseStringRule(parsedRule, fieldName);
      case 'number':
        return this.parseNumberRule(parsedRule, fieldName);
      case 'boolean':
        return this.parseBooleanRule(parsedRule, fieldName);
      case 'date':
        return this.parseDateRule(parsedRule, fieldName);
      case 'enum':
        return this.parseEnumRule(parsedRule, fieldName);
      case 'reference':
        return this.parseReferenceRule(parsedRule, fieldName);
      default:
        return parsedRule;
    }
  }

  parseStringRule(rule, fieldName) {
    if (rule.format && !this.validFormats.includes(rule.format)) {
      throw new Error(`字段 ${fieldName} 的 format 必须是: ${this.validFormats.join(', ')}`);
    }

    if (rule.format === 'custom' && !rule.pattern) {
      throw new Error(`字段 ${fieldName} 使用 custom 格式时必须提供 pattern`);
    }

    if (rule.pattern) {
      try {
        new RegExp(rule.pattern);
      } catch (e) {
        throw new Error(`字段 ${fieldName} 的 pattern 不是有效的正则表达式`);
      }
    }

    const isBinary = rule.format && this.binaryFormats.has(rule.format);

    return {
      format: rule.format || null,
      pattern: rule.pattern || null,
      minLength: rule.minLength || 1,
      maxLength: rule.maxLength || 20,
      options: rule.options || [],
      prefix: rule.prefix || '',
      suffix: rule.suffix || '',
      outputFormat: rule.outputFormat || 'dataUrl',
      width: rule.width ? Math.max(10, Math.min(4096, Number(rule.width))) : 200,
      height: rule.height ? Math.max(10, Math.min(4096, Number(rule.height))) : 200,
      pages: rule.pages ? Math.max(1, Math.min(100, Number(rule.pages))) : 1,
      fileCount: rule.fileCount ? Math.max(1, Math.min(50, Number(rule.fileCount))) : 2,
      duration: rule.duration ? Math.max(1, Math.min(60, Number(rule.duration))) : 1,
      seconds: rule.seconds ? Math.max(1, Math.min(60, Number(rule.seconds))) : 1,
      sampleRate: rule.sampleRate ? Math.max(8000, Math.min(44100, Number(rule.sampleRate))) : 22050,
      size: rule.size ? Math.max(1, Math.min(10485760, Number(rule.size))) : 1024,
      _isBinary: isBinary
    };
  }

  parseNumberRule(rule, fieldName) {
    const min = rule.min !== undefined ? Number(rule.min) : 0;
    const max = rule.max !== undefined ? Number(rule.max) : 100;

    if (min > max) {
      throw new Error(`字段 ${fieldName} 的 min 不能大于 max`);
    }

    return {
      min: min,
      max: max,
      decimal: rule.decimal || 0,
      step: rule.step || 1
    };
  }

  parseBooleanRule(rule, fieldName) {
    const probability = rule.probability !== undefined ? Number(rule.probability) : 0.5;

    if (probability < 0 || probability > 1) {
      throw new Error(`字段 ${fieldName} 的 probability 必须在 0 到 1 之间`);
    }

    return {
      probability: probability
    };
  }

  parseDateRule(rule, fieldName) {
    const now = Date.now();
    const defaultMin = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    const defaultMax = new Date(now).toISOString();

    return {
      min: rule.min || defaultMin,
      max: rule.max || defaultMax,
      format: rule.format || 'YYYY-MM-DD HH:mm:ss'
    };
  }

  parseEnumRule(rule, fieldName) {
    if (!Array.isArray(rule.options) || rule.options.length === 0) {
      throw new Error(`字段 ${fieldName} 必须提供 options 数组`);
    }

    return {
      options: rule.options,
      weights: rule.weights || []
    };
  }

  parseReferenceRule(rule, fieldName) {
    if (!rule.model || typeof rule.model !== 'string') {
      throw new Error(`字段 ${fieldName} 必须指定引用的 model`);
    }

    if (!rule.field || typeof rule.field !== 'string') {
      throw new Error(`字段 ${fieldName} 必须指定引用的 field`);
    }

    return {
      model: rule.model,
      field: rule.field,
      unique: rule.unique || false
    };
  }
}

module.exports = ModelParser;
