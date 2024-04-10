function parseQuery(query) {
  // Remove leading/trailing whitespaces
  query = query.trim();

  // Initialize vars
  let selectPart, fromPart;

  // Split query at WHERE clause (if exists)
  const whereSplit = query.split(/\sWHERE\s/i);
  query = whereSplit[0]; // Get SELECT-FROM part

  // get where clause if exists
  const whereClause = whereSplit.length > 1 ? whereSplit[1].trim() : null;

  // Split remaining query at JOIN clause (if exists)
  const joinSplit = query.split(/\s(INNER|OUTER|LEFT) JOIN\s/i);
  selectPart = joinSplit[0].trim(); // Get everything before JOIN clause

  // Extract JOIN clause
  const { joinType, joinTable, joinCondition } = parseJoinClause(query);

  // Parse SELECT-FROM part
  const selectRegex = /^SELECT\s(.+?)\sFROM\s(.+)$/i;
  const selectMatch = selectPart.match(selectRegex);
  if (!selectMatch) {
    throw new Error("Invalid SELECT-FROM clause");
  }

  const [, fields, table] = selectMatch;

  // Parse WHERE clause (if exists)
  let whereClauses = [];
  if (whereClause) {
    whereClauses = parseWhereClause(whereClause);
  }

  // Capture GROUP BY clause
  const groupByRegex = /\sGROUP BY\s(.+)/i;
  const groupByMatch = query.match(groupByRegex);

  let groupByFields = null;
  if (groupByMatch) {
    groupByFields = groupByMatch[1].split(",").map((field) => field.trim());
  }

  return {
    fields: fields.split(",").map((field) => field.trim()),
    table: table.trim(),
    whereClauses,
    joinType,
    joinTable,
    joinCondition,
    groupByFields,
  };
}

function parseWhereClause(whereString) {
  const conditionRegex = /(.*?)(=|!=|>|<|<=|>=)(.*)/;
  return whereString.split(/ AND | OR /i).map((conditionString) => {
    const match = conditionString.match(conditionRegex);
    if (match) {
      const [, field, operator, value] = match;
      return { field: field.trim(), operator, value: value.trim() };
    } else {
      throw new Error("Invalid WHERE clause format");
    }
  });
}

function parseJoinClause(query) {
  const joinRegex =
    /\s(INNER|LEFT|RIGHT) JOIN\s(.+?)\sON\s([\w.]+)\s*=\s*([\w.]+)/i;
  const joinMatch = query.match(joinRegex);

  if (joinMatch) {
    return {
      joinType: joinMatch[1].trim(),
      joinTable: joinMatch[2].trim(),
      joinCondition: {
        left: joinMatch[3].trim(),
        right: joinMatch[4].trim(),
      },
    };
  }

  return {
    joinType: null,
    joinTable: null,
    joinCondition: null,
  };
}

module.exports = { parseQuery, parseJoinClause };
