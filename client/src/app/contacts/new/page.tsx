"use client";

import { createContactSchema } from "@/lib/schemas";
import { useCreateContactMutation } from "@/state/api";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

type CreateContactFormValues = z.infer<typeof createContactSchema>;

const AddContactPage = () => {
  const router = useRouter();

  // IMPORTANT: This memberId is currently hardcoded.
  const memberId = "e3b04fcf454a94d025ceb96c93423068";

  const [createContact, { isLoading }] = useCreateContactMutation();

  const form = useForm<CreateContactFormValues>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      NAME: "",
      LAST_NAME: "",
      SECOND_NAME: "",
      PHONE: "",
      EMAIL: "",
      WEB: "",
      ADDRESS_1: "",
      ADDRESS_CITY: "",
      ADDRESS_REGION: "",
      ADDRESS_PROVINCE: "",
      requisite: {
        NAME: "",
        RQ_BANK_NAME: "",
        RQ_ACC_NUM: "",
      },
    },
  });

  const onSubmit = async (values: CreateContactFormValues) => {
    if (!memberId) {
      toast("Member ID is missing. Cannot create contact.");
      return;
    }

    try {
      // Clean up empty string values for optional fields
      const dataToSend = Object.fromEntries(
        Object.entries(values).filter(([_, value]) => value !== "")
      ) as CreateContactFormValues;

      // If requisite is present, clean its empty strings too
      if (dataToSend.requisite) {
        dataToSend.requisite = Object.fromEntries(
          Object.entries(dataToSend.requisite).filter(
            ([_, value]) => value !== ""
          )
        );
        // If all requisite fields become empty after filtering, remove the requisite object itself
        if (Object.keys(dataToSend.requisite).length === 0) {
          delete dataToSend.requisite;
        }
      } else {
        // If requisite is explicitly undefined or null from the form due to partial(), ensure it's removed if no data
        delete dataToSend.requisite;
      }

      await createContact({ memberId, data: dataToSend }).unwrap();
      toast("Contact created successfully!");
      router.push("/contacts"); // Redirect to contacts list
    } catch (error: any) {
      console.error("Failed to create contact:", error);
      toast(
        `Failed to create contact: ${
          error.data?.message || error.error || "Unknown error"
        }`
      );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Add New Contact</h1>
        <Link href="/contacts">
          <Button variant="outline">Back to Contacts</Button>
        </Link>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="NAME"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    First Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="LAST_NAME"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="SECOND_NAME"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="A." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="PHONE"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+84 123 456 789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="EMAIL"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="WEB"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="ADDRESS_1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Textarea placeholder="123 Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="ADDRESS_CITY"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="Hanoi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ADDRESS_REGION"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>District/Region</FormLabel>
                  <FormControl>
                    <Input placeholder="Hoan Kiem" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ADDRESS_PROVINCE"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ward/Province</FormLabel>
                  <FormControl>
                    <Input placeholder="Hang Bac" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator className="my-8" />

          {/* Banking Information */}
          <h2 className="text-xl font-semibold mb-4">
            Banking Information (Optional)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="requisite.NAME"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requisite Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Company Bank Account" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requisite.RQ_BANK_NAME"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Vietcombank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requisite.RQ_ACC_NUM"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Account Number</FormLabel>
                  <FormControl>
                    <Input placeholder="1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating Contact..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddContactPage;
