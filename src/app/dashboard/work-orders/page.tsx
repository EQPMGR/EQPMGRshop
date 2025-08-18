'use client';

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, DocumentData } from "firebase/firestore";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkOrder = {
  id: string;
  customerName: string;
  bike: string;
  issueDescription: string;
  createdAt: string;
  status: "New" | "In Progress" | "Awaiting Parts" | "Completed" | "Pending";
  priority?: "Low" | "Medium" | "High";
  priorityLoading?: boolean;
};

const statusVariant: { [key in WorkOrder['status']]: "default" | "secondary" | "destructive" | "outline" } = {
  "New": "default",
  "In Progress": "secondary",
  "Awaiting Parts": "destructive",
  "Completed": "outline",
  "Pending": "default",
};

const priorityVariant: { [key in NonNullable<WorkOrder['priority']>]: "default" | "secondary" | "destructive" } = {
  "Low": "outline",
  "Medium": "secondary",
  "High": "destructive"
};

export default function WorkOrdersPage() {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    };

    setLoading(true);
    const q = query(collection(db, "workOrders"), where("serviceProviderId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const orders: WorkOrder[] = [];
      querySnapshot.forEach((doc: DocumentData) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          customerName: data.userName || 'N/A',
          bike: `${data.equipmentBrand} ${data.equipmentModel}` || 'N/A',
          issueDescription: data.serviceType || 'No description',
          createdAt: data.createdAt?.toDate().toLocaleDateString() || 'N/A',
          status: data.status === 'pending' ? 'New' : data.status || 'New',
        });
      });
      setWorkOrders(orders);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching work orders: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

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
         {loading ? (
           <div className="flex items-center justify-center p-8">
             <Loader2 className="h-8 w-8 animate-spin text-primary" />
           </div>
         ) : workOrders.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
                <p>No work orders found.</p>
                <p className="text-sm">When an athlete submits a work order for your shop, it will appear here.</p>
            </div>
         ) : (
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
                  <TableCell className="font-medium">{order.customerName}</TableCell>
                  <TableCell>{order.bike}</TableCell>
                  <TableCell>{order.issueDescription}</TableCell>
                  <TableCell>{order.createdAt}</TableCell>
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
        )}
      </div>
    </div>
  );
}
