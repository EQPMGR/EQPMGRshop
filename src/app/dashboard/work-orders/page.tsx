'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Sparkles, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type WorkOrder = {
  id: string;
  customer: string;
  bike: string;
  issue: string;
  received: string;
  status: "New" | "In Progress" | "Awaiting Parts" | "Completed";
  priority?: "Low" | "Medium" | "High";
  priorityLoading?: boolean;
};

const initialWorkOrders: WorkOrder[] = [
  { id: 'WO-001', customer: 'Alice Johnson', bike: 'Trek Madone', issue: 'Brake adjustment', received: '2024-07-20', status: 'New' },
  { id: 'WO-002', customer: 'Bob Williams', bike: 'Specialized Stumpjumper', issue: 'Suspension service', received: '2024-07-19', status: 'In Progress' },
  { id: 'WO-003', customer: 'Charlie Brown', bike: 'Cannondale Synapse', issue: 'Flat tire', received: '2024-07-19', status: 'Completed' },
  { id: 'WO-004', customer: 'Diana Prince', bike: 'Giant TCR', issue: 'Derailleur replacement', received: '2024-07-18', status: 'Awaiting Parts' },
];

const statusVariant: { [key in WorkOrder['status']]: "default" | "secondary" | "destructive" | "outline" } = {
  "New": "default",
  "In Progress": "secondary",
  "Awaiting Parts": "destructive",
  "Completed": "outline"
};

const priorityVariant: { [key in NonNullable<WorkOrder['priority']>]: "default" | "secondary" | "destructive" } = {
  "Low": "outline",
  "Medium": "secondary",
  "High": "destructive"
};


export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);

  const handleGetPriority = (id: string) => {
    setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, priorityLoading: true } : wo));
    
    // Simulate AI call
    setTimeout(() => {
        const priorities: Array<WorkOrder['priority']> = ["Low", "Medium", "High"];
        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
        setWorkOrders(prev => prev.map(wo => wo.id === id ? { ...wo, priority: randomPriority, priorityLoading: false } : wo));
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-primary">Work Orders</h1>
        <Button className="bg-accent hover:bg-accent/90">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Work Order
        </Button>
      </div>
      
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Bike</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>AI Priority</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.customer}</TableCell>
                <TableCell>{order.bike}</TableCell>
                <TableCell>{order.issue}</TableCell>
                <TableCell>{order.received}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                </TableCell>
                <TableCell>
                  {order.priority ? (
                     <Badge variant={priorityVariant[order.priority]}>{order.priority}</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => handleGetPriority(order.id)} disabled={order.priorityLoading}>
                      {order.priorityLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4 text-accent" />
                      )}
                      Get Priority
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Update Status</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-500">Cancel Order</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
