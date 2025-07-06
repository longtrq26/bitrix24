"use client";

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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_MEMBER_ID } from "@/lib/constants";
import { UpdateContactFormValues, updateContactSchema } from "@/lib/schemas";
import { cleanObject } from "@/lib/utils";
import {
  useGetContactDetailsQuery,
  useUpdateContactMutation,
} from "@/state/api";
import { ApiUpdateContactData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const EditContactPage = () => {
  const { id: contactId } = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = DEFAULT_MEMBER_ID;

  const {
    data: contactData,
    isLoading,
    error: contactError,
  } = useGetContactDetailsQuery(
    { memberId, contactId },
    { skip: !memberId || !contactId }
  );

  const [updateContact] = useUpdateContactMutation();

  const form = useForm<UpdateContactFormValues>({
    resolver: zodResolver(updateContactSchema),
    defaultValues: {
      NAME: "",
      LAST_NAME: "",
      PHONE: "",
      EMAIL: "",
      WEB: "",
      ADDRESS_1: "",
      ADDRESS_CITY: "",
      ADDRESS_REGION: "",
      ADDRESS_PROVINCE: "",
      requisite: { NAME: "", RQ_BANK_NAME: "", RQ_ACC_NUM: "" },
    },
  });

  useEffect(() => {
    if (contactData) {
      form.reset({
        NAME: contactData.NAME || "",
        LAST_NAME: contactData.LAST_NAME || "",
        PHONE: contactData.PHONE?.[0]?.VALUE || "",
        EMAIL: contactData.EMAIL?.[0]?.VALUE || "",
        WEB: contactData.WEB?.[0]?.VALUE || "",
        ADDRESS_1: contactData.ADDRESS_1 || "",
        ADDRESS_CITY: contactData.ADDRESS_CITY || "",
        ADDRESS_REGION: contactData.ADDRESS_REGION || "",
        ADDRESS_PROVINCE: contactData.ADDRESS_PROVINCE || "",
        requisite: {
          NAME: contactData.requisite?.NAME || "",
          RQ_BANK_NAME: contactData.requisite?.RQ_BANK_NAME || "",
          RQ_ACC_NUM: contactData.requisite?.RQ_ACC_NUM || "",
        },
      });
    }
  }, [contactData, form]);

  const onSubmit = async (values: UpdateContactFormValues) => {
    if (!memberId || !contactId) {
      toast.error("Missing memberId or contactId");
      return;
    }

    const dirty = form.formState.dirtyFields;

    const dataToSend: ApiUpdateContactData = {};

    for (const key of [
      "NAME",
      "LAST_NAME",
      "ADDRESS_1",
      "ADDRESS_CITY",
      "ADDRESS_REGION",
      "ADDRESS_PROVINCE",
    ] as const) {
      if (dirty[key]) {
        const value = values[key];
        if (value !== "") dataToSend[key] = value;
      }
    }

    const multifields: Array<
      keyof Pick<ApiUpdateContactData, "PHONE" | "EMAIL" | "WEB">
    > = ["PHONE", "EMAIL", "WEB"];

    multifields.forEach((field) => {
      if (dirty[field]) {
        const val = values[field] as string;
        dataToSend[field] = val === "" ? [] : [{ VALUE: val }];
      }
    });

    // Handle requisite
    if (dirty.requisite) {
      const cleaned = cleanObject(values.requisite || {});
      const hasData = Object.keys(cleaned).length > 0;
      if (hasData) {
        dataToSend.requisite = cleaned;
      } else {
        dataToSend.requisite = null;
      }
    }

    try {
      await updateContact({ contactId, memberId, data: dataToSend }).unwrap();
      toast.success("Contact updated!");
      router.push(`/contacts/${contactId}`);
    } catch (error: any) {
      const msg = error?.data?.message || error?.error || "Unknown error";
      toast.error(`Failed to update: ${msg}`);
    }
  };

  if (!contactId || !memberId) {
    return <p className="p-4 text-red-500">Missing member ID or contact ID</p>;
  }

  if (isLoading) {
    return <p className="p-4 text-gray-600">Loading contact details...</p>;
  }

  if (contactError) {
    return (
      <div className="p-4 text-red-600">
        <p>Failed to load contact: {JSON.stringify(contactError)}</p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mt-4"
        >
          ← Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Update Contact</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the contact information below.
          </p>
        </div>
        <Link href="/contacts">
          <Button variant="ghost">← Back to Contacts</Button>
        </Link>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 bg-white dark:bg-gray-950 p-6 rounded-lg border shadow-sm"
        >
          {/* Basic Information */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="NAME"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      First Name<span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="A" {...field} />
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
                      <Input placeholder="Nguyen Van" {...field} />
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
                      <Input placeholder="example@mail.com" {...field} />
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
                      <Input placeholder="https://company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Address</h2>
            <FormField
              control={form.control}
              name="ADDRESS_1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="39 Nguyen Huu Huan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
                    <FormLabel>District</FormLabel>
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
                    <FormLabel>Ward</FormLabel>
                    <FormControl>
                      <Input placeholder="Ly Thai To" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Banking Info */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Banking Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="requisite.NAME"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Nguyen Van A" {...field} />
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
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input placeholder="0123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Contact"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default EditContactPage;
