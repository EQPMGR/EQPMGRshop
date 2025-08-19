
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export type Employee = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Mechanic" | "Staff";
  shopId: string;
};

export default function EmployeesPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);

     useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        const q = query(collection(db, 'employees'), where('shopId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEmployees: Employee[] = [];
            snapshot.forEach((doc) => {
                fetchedEmployees.push({ id: doc.id, ...doc.data() } as Employee);
            });
            setEmployees(fetchedEmployees);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching employees: ", error);
            toast({ title: "Error", description: "Could not fetch employees.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, toast]);

    const handleAddEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) return;

        setAdding(true);
        const formData = new FormData(event.currentTarget);
        const newEmployeeData = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            role: 'Staff', // default role
            shopId: user.uid,
        };
        try {
            await addDoc(collection(db, 'employees'), newEmployeeData);
            toast({ title: "Success", description: "Employee added successfully."});
            setOpen(false);
            event.currentTarget.reset();
        } catch (error: any) {
             toast({ title: "Error", description: error.message || "Failed to add employee.", variant: "destructive"});
        } finally {
            setAdding(false);
        }
    }

    const handleDeleteEmployee = async (employeeId: string) => {
        try {
            await deleteDoc(doc(db, 'employees', employeeId));
            toast({ title: "Success", description: "Employee deleted."});
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to delete employee.", variant: "destructive"});
        }
    }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold text-primary">Employees</h1>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Employee
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle className="font-headline text-primary">Add New Employee</DialogTitle>
                <DialogDescription>
                    Enter the details for the new employee. They will receive an invitation to set up their account.
                </DialogDescription>
                </DialogHeader>
                <form id="add-employee-form" onSubmit={handleAddEmployee}>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                        Name
                    </Label>
                    <Input id="name" name="name" className="col-span-3" required />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                        Email
                    </Label>
                    <Input id="email" name="email" type="email" className="col-span-3" required />
                    </div>
                </div>
                </form>
                 <DialogFooter>
                    <Button type="submit" form="add-employee-form" className="bg-accent hover:bg-accent/90" disabled={adding}>
                        {adding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : 'Send Invitation'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        {loading ? (
             <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No employees found.
                    </TableCell>
                </TableRow>
            ) : (
                employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>
                  <Badge variant={employee.role === 'Admin' ? 'default' : 'secondary'}>{employee.role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <AlertDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem>Edit</DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-red-500 focus:text-red-500">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the employee record.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEmployee(employee.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}

