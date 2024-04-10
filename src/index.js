const { parseQuery } = require("./queryParser");
const readCSV = require("./csvReader");

// Helper functions for different JOIN types
function performInnerJoin(data, joinData, joinCondition, fields, table) {
  data = data.flatMap((mainRow) => {
    return joinData
      .filter((joinRow) => {
        const mainValue = mainRow[joinCondition.left.split(".")[1]];
        const joinValue = joinRow[joinCondition.right.split(".")[1]];
        return mainValue === joinValue;
      })
      .map((joinRow) => {
        return fields.reduce((acc, field) => {
          const [tableName, fieldName] = field.split(".");
          acc[field] =
            tableName === table ? mainRow[fieldName] : joinRow[fieldName];
          return acc;
        }, {});
      });
  });

  return data;
}

function performLeftJoin(data, joinData, joinCondition, fields, table) {
  return data.flatMap((mainRow) => {
    const matchingJoinRows = joinData.filter((joinRow) => {
      const mainValue = getValueFromRow(mainRow, joinCondition.left);
      const joinValue = getValueFromRow(joinRow, joinCondition.right);
      return mainValue === joinValue;
    });

    if (matchingJoinRows.length === 0) {
      return [createResultRow(mainRow, null, fields, table, true)];
    }

    return matchingJoinRows.map((joinRow) =>
      createResultRow(mainRow, joinRow, fields, table, true)
    );
  });
}

function getValueFromRow(row, compoundFieldName) {
  const [tableName, fieldName] = compoundFieldName.split(".");
  return row[`${tableName}.${fieldName}`] || row[fieldName];
}

function performRightJoin(data, joinData, joinCondition, fields, table) {
  // Cache the structure of a main table row (keys only)
  const mainTableRowStructure =
    data.length > 0
      ? Object.keys(data[0]).reduce((acc, key) => {
          acc[key] = null; // Set all values to null initially
          return acc;
        }, {})
      : {};

  return joinData.map((joinRow) => {
    const mainRowMatch = data.find((mainRow) => {
      const mainValue = getValueFromRow(mainRow, joinCondition.left);
      const joinValue = getValueFromRow(joinRow, joinCondition.right);
      return mainValue === joinValue;
    });

    // Use the cached structure if no match is found
    const mainRowToUse = mainRowMatch || mainTableRowStructure;

    // Include all necessary fields from the 'student' table
    return createResultRow(mainRowToUse, joinRow, fields, table, true);
  });
}

function createResultRow(
  mainRow,
  joinRow,
  fields,
  table,
  includeAllMainFields
) {
  const resultRow = {};

  if (includeAllMainFields) {
    // Include all fields from the main table
    Object.keys(mainRow || {}).forEach((key) => {
      const prefixedKey = `${table}.${key}`;
      resultRow[prefixedKey] = mainRow ? mainRow[key] : null;
    });
  }

  // Now, add or overwrite with the fields specified in the query
  fields.forEach((field) => {
    const [tableName, fieldName] = field.includes(".")
      ? field.split(".")
      : [table, field];
    resultRow[field] =
      tableName === table && mainRow
        ? mainRow[fieldName]
        : joinRow
        ? joinRow[fieldName]
        : null;
  });

  return resultRow;
}

async function executeSELECTQuery(query) {
  // Now we will have joinTable, joinCondition in the parsed query
  const { fields, table, whereClauses, joinType, joinTable, joinCondition } =
    parseQuery(query);
  let data = await readCSV(`${table}.csv`);

  // Logic for applying JOINs
  if (joinTable && joinCondition) {
    const joinData = await readCSV(`${joinTable}.csv`);
    switch (joinType.toUpperCase()) {
      case "INNER":
        data = performInnerJoin(data, joinData, joinCondition, fields, table);
        break;
      case "LEFT":
        data = performLeftJoin(data, joinData, joinCondition, fields, table);
        break;
      case "RIGHT":
        data = performRightJoin(data, joinData, joinCondition, fields, table);
        break;
      // Handle default case or unsupported JOIN types
      default:
        throw new Error(`Unsupported JOIN type: ${joinType}`);
    }
  }

  // Apply WHERE clause filtering after JOIN (or on the original data if no join)
  const filteredData =
    whereClauses.length > 0
      ? data.filter((row) =>
          whereClauses.every((clause) => evaluateCondition(row, clause))
        )
      : data;

  // Select the specified fields
  return filteredData.map((row) => {
    const selectedRow = {};
    fields.forEach((field) => {
      selectedRow[field] = row[field];
    });
    return selectedRow;
  });
}

function evaluateCondition(row, clause) {
  const { field, operator, value } = clause;
  switch (operator) {
    case "=":
      return row[field] === value;
    case "!=":
      return row[field] !== value;
    case ">":
      return row[field] > value;
    case "<":
      return row[field] < value;
    case ">=":
      return row[field] >= value;
    case "<=":
      return row[field] <= value;
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

module.exports = executeSELECTQuery;
