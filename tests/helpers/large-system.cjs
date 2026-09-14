const base = "../../.test-build/system/";
const { createSystemSeed } = require(base + "seed");
const { newStep, emptyMap } = require(base + "maps/model");
const { emptyMeasurement, newKPI, newImprovement } = require(
  base + "measurement/model",
);
module.exports = function largeSystem(count = 100) {
  const seed = createSystemSeed(),
    system = {
      version: 1,
      departments: [],
      roles: [],
      people: [],
      processes: [],
    };
  for (let i = 0; i < 20; i++)
    system.departments.push({
      ...seed.departments[0],
      id: `d${i}`,
      name: `واحد آزمایش ${i}`,
      parentDepartmentId: undefined,
      managerRoleId: undefined,
    });
  for (let i = 0; i < 200; i++)
    system.people.push({
      ...seed.people[0],
      id: `u${i}`,
      name: `همکار آزمایش ${i}`,
    });
  for (let i = 0; i < 100; i++)
    system.roles.push({
      ...seed.roles[0],
      id: `r${i}`,
      title: `نقش آزمایش ${i}`,
      departmentId: `d${i % 20}`,
      personId: `u${i}`,
      reportsToRoleId: undefined,
      isFounderRole: false,
    });
  const maps = [],
    records = [];
  for (let i = 0; i < count; i++) {
    const id = `large${i}`,
      p = {
        ...seed.processes[0],
        id,
        code: `L${i}`,
        name: `فرآیند آزمایش ${i}`,
        departmentId: `d${i % 20}`,
        ownerRoleId: `r${i % 100}`,
        systemizationStage: "implemented",
      };
    system.processes.push(p);
    const map = emptyMap(id);
    for (let j = 0; j < (i === 0 ? 105 : 3); j++)
      map.steps.push({
        ...newStep(id, `${id}-s${j}`),
        type: j === 0 ? "start" : j === (i === 0 ? 104 : 2) ? "end" : "action",
        title: `مرحله ${j}`,
        ownerRoleId: p.ownerRoleId,
        input: "درخواست",
        output: "نتیجه",
        workTimeMinutes: 10,
        waitTimeMinutes: 2,
        positionX: j * 320,
      });
    map.connections = map.steps
      .slice(1)
      .map((s, j) => ({
        id: `${id}-e${j}`,
        processId: id,
        sourceStepId: map.steps[j].id,
        targetStepId: s.id,
        label: "",
        condition: "",
        type: "sequence",
      }));
    maps.push(map);
    const record = emptyMeasurement(id),
      kpi = {
        ...newKPI(id),
        id: `${id}-kpi`,
        name: "نرخ تکمیل",
        unit: "درصد",
        ownerRoleId: p.ownerRoleId,
        status: "active",
        baselineValue: 0,
        targetValue: 100,
      };
    record.kpis = [kpi];
    for (let j = 0; j < (i === 0 ? 510 : 1); j++)
      record.entries.push({
        id: `${id}-v${j}`,
        processId: id,
        kpiId: kpi.id,
        periodDate: new Date(Date.UTC(2024, 0, 1 + j))
          .toISOString()
          .slice(0, 10),
        value: 70,
        note: "داده آزمایش",
        confidence: "high",
        enteredAt: "2026-09-14T00:00:00.000Z",
      });
    for (let j = 0; j < (i === 0 ? 210 : 0); j++)
      record.improvements.push({
        ...newImprovement(id),
        id: `${id}-im${j}`,
        title: `اقدام آزمایش ${j}`,
        ownerRoleId: p.ownerRoleId,
        dueDate: "2026-09-20",
      });
    records.push(record);
  }
  return {
    system,
    maps: { version: 1, maps },
    measurement: { version: 1, records },
    evidence: (id) => ({ system, asis: maps.find((m) => m.processId === id) }),
  };
};
