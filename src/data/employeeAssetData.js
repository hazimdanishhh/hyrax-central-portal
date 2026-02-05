export const employeeAssetData = [
  {
    title: "Asset Information",
    source: "assets",
    fields: [
      {
        label: "Assigned Assets",
        value: (assets) => assets || [], // just pass the array
      },
    ],
  },
];
