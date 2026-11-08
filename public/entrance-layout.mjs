// Shared by the gate and the enclosure so the wall always meets its outer piers.
export const ENTRANCE={z:39,outerPier:11,innerPier:6};

// Two matching pairs mark equal intervals from the gate toward the temple steps.
export const ENTRANCE_LIGHTS=[10,20].flatMap(offset=>[-1,1].map(side=>({x:side*9,z:ENTRANCE.z-offset})));
