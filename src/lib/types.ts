

export interface Equipment {
    id: string;
    name: string;
    type: string;
    brand: string;
    model: string;
    frameSize?: string;
    size?: string;
    purchaseDate?: Date;
    purchasePrice?: number;
    totalDistance: number;
    totalHours: number;
    components: Component[];
    maintenanceLog: MaintenanceLog[];
    fitData?: BikeFitData;
    associatedEquipmentIds?: string[];
}

export interface Component extends UserComponent {
  // from MasterComponent
  componentName: string;
  componentGroup: string;
  brand?: string;
  model?: string;
  series?: string;
  lifespanHours?: number | null;
  lifespanDistance?: number | null;
}

export interface MasterComponent {
  id: string;
  name: string; // Changed from componentName
  system: string; // Changed from componentGroup
  brand?: string;
  model?: string;
  series?: string;
  lifespanHours?: number;
  lifespanDistance?: number;
  size?: string;
}

export interface UserComponent {
  id: string; // The user-specific component ID
  masterComponentId: string;
  purchaseDate?: Date | null;
  lastServiceDate?: Date | null;
  totalDistance: number;
  totalHours: number;
  wearPercentage: number;
  notes?: string;
  size?: string;
  parentUserComponentId?: string;
}

export interface MaintenanceLog {
  id: string;
  date: Date;
  componentName: string;
  notes: string;
  serviceType: 'serviced' | 'replaced' | 'inspected';
  cost?: number;
  shopId?: string;
  shopName?: string;
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

export type WorkOrderStatus =
  | "New"
  | "Customer Contacted"
  | "Appointment Booked"
  | "Bike in Shop"
  | "Awaiting Parts"
  | "Awaiting Service"
  | "In Service"
  | "Testing"
  | "Bike Ready"
  | "Completed";

export type WorkOrder = {
  id: string;
  customerName: string;
  bike: string;
  issueDescription: string;
  createdAt: string;
  status: WorkOrderStatus;
  priority?: "Low" | "Medium" | "High";
  priorityLoading?: boolean;
  userEmail: string;
  userPhone: string;
  notes: string;
  equipmentName: string;
  userId: string;
  equipmentId: string;
};

export const allStatuses: WorkOrderStatus[] = [
  "New",
  "Customer Contacted",
  "Appointment Booked",
  "Bike in Shop",
  "Awaiting Parts",
  "Awaiting Service",
  "In Service",
  "Testing",
  "Bike Ready",
  "Completed",
];

export const statusVariant: { [key in WorkOrderStatus]: "default" | "secondary" | "destructive" | "outline" } = {
  "New": "default",
  "Customer Contacted": "secondary",
  "Appointment Booked": "secondary",
  "Bike in Shop": "secondary",
  "Awaiting Parts": "destructive",
  "Awaiting Service": "secondary",
  "In Service": "secondary",
  "Testing": "secondary",
  "Bike Ready": "outline",
  "Completed": "outline",
};
  
