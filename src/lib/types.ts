
export interface Equipment {
    id: string;
    name: string;
    type: string;
    brand: string;
    model: string;
    fitData?: BikeFitData;
}

export interface CleatPosition {
    foreAft?: number;
    lateral?: number;
    rotational?: number;
}
  
export interface BikeFitData {
    saddleHeight?: number;
    saddleHeightOverBars?: number;
    saddleToHandlebarReach?: number;
    saddleAngle?: number;
    saddleForeAft?: number;
    saddleBrandModel?: string;
    stemLength?: number;
    stemAngle?: number;
    handlebarBrandModel?: string;
    handlebarWidth?: number;
    handlebarAngle?: number;
    handlebarExtension?: number;
    brakeLeverPosition?: string;
    crankLength?: number;
    hasAeroBars?: boolean;
    cleatPosition?: CleatPosition;
}
  
