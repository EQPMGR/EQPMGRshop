'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type Employee = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Mechanic" | "Staff";
};

const initialEmployees: Employee[] = [
  { id: 'EMP-001', name: 'John Doe', email: 'john.d@example.com', role: 'Admin' },
  { id: 'EMP-002', name: 'Jane Smith', email: 'jane.s@example.com', role: 'Mechanic' },
  { id: 'EMP-003', name: 'Sam Wilson', email: 'sam.w@example.com', role: 'Mechanic' },
  { id: 'EMP-004', name: 'Lisa Ray', email: 'lisa.r@example.com', role: 'Staff' },
];

export default function EmployeesPage() {
    const [employees, setEmployees] = useState(initialEmployees);
    const [open, setOpen] = useState(false);

    const handleAddEmployee = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const newEmployee: Employee = {
            id: `EMP-00${employees.length + 1}`,
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            role: 'Staff', // default role
        };
        setEmployees([...employees, newEmployee]);
        setOpen(false);
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
                    <Button type="submit" form="add-employee-form" className="bg-accent hover:bg-accent/90">Send Invitation</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
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
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.email}</TableCell>
                <TableCell>
                  <Badge variant={employee.role === 'Admin' ? 'default' : 'secondary'}>{employee.role}</Badge>
                </TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500 focus:text-red-500">
                                <Trash2 className="mr-2 h-4 w-4"/> Delete
                            </DropdownMenuItem>
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
