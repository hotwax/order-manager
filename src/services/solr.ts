import { api, commonUtil } from '@common';

type SolrJsonPayload = {
  query?: string;
  filter?: string | string[];
  fields?: string;
  facet?: Record<string, unknown>;
  params?: Record<string, unknown>;
};

type LegacySolrPayload = {
  coreName?: string;
  collection?: string;
  json?: SolrJsonPayload;
};

type ProductSearchParams = {
  keyword?: string;
  sort?: string;
  qf?: string;
  viewSize?: number;
  viewIndex?: number;
  filters?: Record<string, { value: string | string[]; op?: string }>;
};

enum OPERATOR {
  AND = 'AND',
  OR = 'OR',
}

function toExecuteSolrQueryPayload(payload: LegacySolrPayload) {
  const json = payload.json ?? {};
  const params = { ...(json.params ?? {}) };

  if (json.facet) params['json.facet'] = JSON.stringify(json.facet);

  return {
    query: json.query ?? '*:*',
    filter: json.filter,
    fields: json.fields,
    params,
    collection: payload.collection ?? payload.coreName
  };
}

export async function executeSolrQuery(payload: LegacySolrPayload) {
  const response = await api({
    url: 'admin/search/query',
    method: 'post',
    data: toExecuteSolrQueryPayload(payload)
  }) as any;

  return {
    ...response,
    data: response.data?.response ?? response.data
  };
}

function escapeProductKeyword(keyword: string) {
  const tokens: string[] = [];
  const regEx = /[`!@#$%^&*()_+\-=\\|,.<>?~]/;

  keyword.split(' ').forEach((token: string) => {
    if (regEx.test(token)) {
      const matchedTokens = [...new Set(token.match(regEx))];
      matchedTokens?.forEach((matchedToken: string) => {
        tokens.push(token.split(matchedToken).join(`\\\\${matchedToken}`));
      });
    } else {
      tokens.push(token);
    }
  });

  return tokens.join(`* ${OPERATOR.OR} `);
}

function buildProductSearchPayload(params: ProductSearchParams) {
  const rows = params.viewSize ?? 100;
  const start = rows * (params.viewIndex ?? 0);
  const keyword = params.keyword?.trim();
  const payload: LegacySolrPayload = {
    json: {
      params: {
        rows,
        start,
        qf: 'productId^20 productName^40 internalName^30 search_goodIdentifications parentProductName',
        sort: 'sort_productName asc',
        defType: 'edismax'
      },
      query: '*:*',
      filter: 'docType: PRODUCT'
    }
  };

  if (keyword) {
    let keywordString = '';

    if (keyword.startsWith('"')) {
      keywordString = keyword.replace('"', '').replace('"', '');
    } else {
      keywordString = escapeProductKeyword(keyword);
      keywordString += `* ${OPERATOR.OR} "${keyword}"^100`;
    }

    if (keywordString) payload.json!.query = `(${keywordString})`;
  } else {
    if (params.qf) payload.json!.params!.qf = params.qf;
    if (params.sort) payload.json!.params!.sort = params.sort;
  }

  if (params.filters) {
    Object.keys(params.filters).forEach((key: string) => {
      const filterValue = params.filters![key].value;

      if (Array.isArray(filterValue)) {
        const filterOperator = params.filters![key].op ? params.filters![key].op : OPERATOR.OR;
        payload.json!.filter += ` ${OPERATOR.AND} ${key}: (${filterValue.join(` ${filterOperator} `)})`;
      } else {
        payload.json!.filter += ` ${OPERATOR.AND} ${key}: ${filterValue}`;
      }
    });
  }

  if (!params.filters?.isVirtual) {
    payload.json!.filter += ` ${OPERATOR.AND} isVirtual: false`;
  }

  return payload;
}

export async function searchProducts(params: ProductSearchParams): Promise<any> {
  try {
    const resp = await executeSolrQuery(buildProductSearchPayload(params));
    const numFound = Number(resp.data?.response?.numFound ?? 0);

    if (resp.status === 200 && !commonUtil.hasError(resp) && numFound > 0) {
      return {
        products: resp.data.response.docs,
        total: numFound
      };
    }

    return {
      products: [],
      total: 0
    };
  } catch (err) {
    return Promise.reject({
      code: 'error',
      message: 'Something went wrong',
      serverResponse: err
    });
  }
}
