// src/app/contacts/edit/[id]/page.tsx
"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import Link from "next/link";
import {
  useGetContactDetailsQuery,
  useUpdateContactMutation,
} from "@/state/api";
import { toast } from "sonner";
import { SerializedError } from "@reduxjs/toolkit/react";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";

// Define Zod schema for UpdateRequisiteDto (similar to Create, but fully optional)
const updateRequisiteSchema = z
  .object({
    // REMOVED: ID: z.string().optional(), // Frontend should not send ID for requisite
    NAME: z.string().optional(),
    RQ_BANK_NAME: z.string().optional(),
    RQ_ACC_NUM: z.string().optional(),
  })
  .partial();

// Define Zod schema for UpdateContactDto (all fields optional)
const updateContactSchema = z.object({
  NAME: z.string().optional(),
  LAST_NAME: z.string().optional(),
  SECOND_NAME: z.string().optional(),
  PHONE: z.string().optional(),
  EMAIL: z
    .string()
    .email({ message: "Invalid email address." })
    .optional()
    .or(z.literal("")),
  WEB: z.string().url({ message: "Invalid URL." }).optional().or(z.literal("")),
  ADDRESS_1: z.string().optional(),
  ADDRESS_CITY: z.string().optional(),
  ADDRESS_REGION: z.string().optional(),
  ADDRESS_PROVINCE: z.string().optional(),
  requisite: updateRequisiteSchema.optional().nullable(),
});

type UpdateContactFormValues = z.infer<typeof updateContactSchema>;

type RequisiteData = z.infer<typeof updateRequisiteSchema>;

// Define the API payload structure separately to be explicit about multifields
interface ApiRequisiteData {
  // REMOVED: ID?: string; // Frontend should not send ID for requisite
  // REMOVED: PRESET_ID?: string; // Frontend should not send PRESET_ID for requisite
  NAME?: string;
  RQ_BANK_NAME?: string;
  RQ_ACC_NUM?: string;
}

interface ApiUpdateContactData {
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PHONE?: string | string[]; // Can be a string or an empty array to clear
  EMAIL?: string | string[];
  WEB?: string | string[];
  ADDRESS_1?: string;
  ADDRESS_CITY?: string;
  ADDRESS_REGION?: string;
  ADDRESS_PROVINCE?: string;
  requisite?: ApiRequisiteData | null; // Can be object or null to clear
}

interface EditContactPageProps {
  params: {
    id: string; // The contact ID from the URL
  };
}

const EditContactPage = () => {
  const { id: contactId } = useParams<EditContactPageProps["params"]>();
  const router = useRouter();

  const memberId = "e3b04fcf454a94d025ceb96c93423068";

  const {
    data: contactData,
    isLoading: isDetailsLoading,
    error: detailsError,
  } = useGetContactDetailsQuery(
    { memberId, contactId },
    { skip: !memberId || !contactId }
  );

  const [updateContact, { isLoading: isUpdating }] = useUpdateContactMutation();

  const form = useForm<UpdateContactFormValues>({
    resolver: zodResolver(updateContactSchema),
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
      requisite: null, // Initial default for the object can be null
    },
  });

  useEffect(() => {
    if (contactData) {
      form.reset({
        NAME: contactData.NAME || "",
        LAST_NAME: contactData.LAST_NAME || "",
        SECOND_NAME: contactData.SECOND_NAME || "",
        PHONE:
          contactData.PHONE && contactData.PHONE.length > 0
            ? contactData.PHONE[0].VALUE
            : "",
        EMAIL:
          contactData.EMAIL && contactData.EMAIL.length > 0
            ? contactData.EMAIL[0].VALUE
            : "",
        WEB:
          contactData.WEB && contactData.WEB.length > 0
            ? contactData.WEB[0].VALUE
            : "",
        ADDRESS_1: contactData.ADDRESS_1 || "",
        ADDRESS_CITY: contactData.ADDRESS_CITY || "",
        ADDRESS_REGION: contactData.ADDRESS_REGION || "",
        ADDRESS_PROVINCE: contactData.ADDRESS_PROVINCE || "",
        // Ensure requisite fields are initialized to empty strings if the object or its fields are null/undefined
        requisite: contactData.requisite
          ? {
              // REMOVED: ID: contactData.requisite.ID || undefined, // Frontend should not set ID for the form field
              NAME: contactData.requisite.NAME || "",
              RQ_BANK_NAME: contactData.requisite.RQ_BANK_NAME || "",
              RQ_ACC_NUM: contactData.requisite.RQ_ACC_NUM || "",
            }
          : {
              // Initialize requisite object with empty strings if it was null from API
              // REMOVED: ID: undefined, // No ID for new requisite
              NAME: "",
              RQ_BANK_NAME: "",
              RQ_ACC_NUM: "",
            },
      });
    }
  }, [contactData, form]);

  const onSubmit = async (values: UpdateContactFormValues) => {
    if (!memberId || !contactId) {
      toast("Member ID or Contact ID is missing. Cannot update contact.");
      return;
    }

    try {
      const dirtyFields = form.formState.dirtyFields;
      const dataToUpdate: ApiUpdateContactData = {};

      // Handle non-multifields and non-requisite fields
      if (dirtyFields.NAME)
        dataToUpdate.NAME = values.NAME === "" ? undefined : values.NAME;
      if (dirtyFields.LAST_NAME)
        dataToUpdate.LAST_NAME =
          values.LAST_NAME === "" ? undefined : values.LAST_NAME;
      if (dirtyFields.SECOND_NAME)
        dataToUpdate.SECOND_NAME =
          values.SECOND_NAME === "" ? undefined : values.SECOND_NAME;
      if (dirtyFields.ADDRESS_1)
        dataToUpdate.ADDRESS_1 =
          values.ADDRESS_1 === "" ? undefined : values.ADDRESS_1;
      if (dirtyFields.ADDRESS_CITY)
        dataToUpdate.ADDRESS_CITY =
          values.ADDRESS_CITY === "" ? undefined : values.ADDRESS_CITY;
      if (dirtyFields.ADDRESS_REGION)
        dataToUpdate.ADDRESS_REGION =
          values.ADDRESS_REGION === "" ? undefined : values.ADDRESS_REGION;
      if (dirtyFields.ADDRESS_PROVINCE)
        dataToUpdate.ADDRESS_PROVINCE =
          values.ADDRESS_PROVINCE === "" ? undefined : values.ADDRESS_PROVINCE;

      // Handle multifields (PHONE, EMAIL, WEB)
      const handleMultiField = (fieldKey: "PHONE" | "EMAIL" | "WEB") => {
        const currentFormValue = form.getValues(fieldKey);

        if (dirtyFields[fieldKey]) {
          if (currentFormValue === "") {
            dataToUpdate[fieldKey] = [];
          } else {
            dataToUpdate[fieldKey] = currentFormValue;
          }
        }
      };

      handleMultiField("PHONE");
      handleMultiField("EMAIL");
      handleMultiField("WEB");

      // Handle nested requisite object
      const requisiteDirtyFields = form.formState.dirtyFields.requisite;
      const requisiteValue = values.requisite;

      // REMOVED: const existingRequisiteId = contactData?.requisite?.ID; // Backend handles ID
      // REMOVED: const presetId = "5"; // Backend handles PRESET_ID

      if (requisiteDirtyFields) {
        const cleanedRequisite: ApiRequisiteData = {};
        let hasMeaningfulRequisiteData = false;

        // REMOVED: If an existing requisite ID is present, include it in the payload for update
        // if (existingRequisiteId) {
        //   cleanedRequisite.ID = existingRequisiteId;
        // }
        // REMOVED: Always include PRESET_ID if you're sending any requisite data for update/creation
        // cleanedRequisite.PRESET_ID = presetId;

        if (
          typeof requisiteDirtyFields === "object" &&
          requisiteDirtyFields !== null
        ) {
          // If the NAME field was dirty, include its value (even if empty to signal a clear)
          if (requisiteDirtyFields.NAME) {
            cleanedRequisite.NAME =
              requisiteValue?.NAME === "" ? undefined : requisiteValue?.NAME;
            hasMeaningfulRequisiteData = true;
          } else if (requisiteValue?.NAME !== "") {
            // If not dirty but has a value, include it for full update
            cleanedRequisite.NAME = requisiteValue?.NAME;
            hasMeaningfulRequisiteData = true;
          }

          // If the RQ_BANK_NAME field was dirty, include its value
          if (requisiteDirtyFields.RQ_BANK_NAME) {
            cleanedRequisite.RQ_BANK_NAME =
              requisiteValue?.RQ_BANK_NAME === ""
                ? undefined
                : requisiteValue?.RQ_BANK_NAME;
            hasMeaningfulRequisiteData = true;
          } else if (requisiteValue?.RQ_BANK_NAME !== "") {
            cleanedRequisite.RQ_BANK_NAME = requisiteValue?.RQ_BANK_NAME;
            hasMeaningfulRequisiteData = true;
          }

          // If the RQ_ACC_NUM field was dirty, include its value
          if (requisiteDirtyFields.RQ_ACC_NUM) {
            cleanedRequisite.RQ_ACC_NUM =
              requisiteValue?.RQ_ACC_NUM === ""
                ? undefined
                : requisiteValue?.RQ_ACC_NUM;
            hasMeaningfulRequisiteData = true;
          } else if (requisiteValue?.RQ_ACC_NUM !== "") {
            cleanedRequisite.RQ_ACC_NUM = requisiteValue?.RQ_ACC_NUM;
            hasMeaningfulRequisiteData = true;
          }
        }

        // Now, decide what to send for 'requisite'
        if (hasMeaningfulRequisiteData) {
          dataToUpdate.requisite = cleanedRequisite;
        } else {
          // If requisite was dirty, but all fields were cleared (or were empty and stayed empty),
          // AND it was an *existing* requisite, we likely want to send null to clear it.
          // This ensures the backend knows to clear the existing requisite.
          const areAllRequisiteFieldsEmptyInForm =
            !requisiteValue ||
            ((requisiteValue.NAME === "" ||
              requisiteValue.NAME === undefined) &&
              (requisiteValue.RQ_BANK_NAME === "" ||
                requisiteValue.RQ_BANK_NAME === undefined) &&
              (requisiteValue.RQ_ACC_NUM === "" ||
                requisiteValue.RQ_ACC_NUM === undefined));

          // Only send null to the backend if there was an existing requisite
          // and the user has explicitly cleared all its fields in the form.
          if (contactData?.requisite?.ID && areAllRequisiteFieldsEmptyInForm) {
            dataToUpdate.requisite = null;
          }
          // If no existing requisite and no new data entered, do nothing for requisite (don't include in dataToUpdate).
        }
      }

      console.log(
        "Data being sent to API:",
        JSON.stringify(dataToUpdate, null, 2)
      );

      await updateContact({ contactId, memberId, data: dataToUpdate }).unwrap();
      toast("Contact updated successfully!");
      router.push(`/contacts/${contactId}`);
    } catch (error: any) {
      console.error("Failed to update contact:", error);
      let errorMessage = "An unknown error occurred";
      if (error && typeof error === "object") {
        if ("status" in error) {
          const fetchError = error as FetchBaseQueryError;
          if (fetchError.data && typeof fetchError.data === "object") {
            // Log the entire data object from the error response
            console.error("Backend/Bitrix error details:", fetchError.data);
            if ("message" in fetchError.data) {
              errorMessage = (fetchError.data as { message: string }).message;
            } else if ("error_description" in fetchError.data) {
              // Common Bitrix error key
              errorMessage = (fetchError.data as { error_description: string })
                .error_description;
            } else {
              errorMessage = JSON.stringify(fetchError.data); // Stringify for generic object
            }
          } else if (typeof fetchError.data === "string") {
            errorMessage = fetchError.data;
          }
        } else if ("message" in error) {
          errorMessage = (error as SerializedError).message ?? errorMessage;
        }
      }
      toast(`Failed to update contact: ${errorMessage}`);
    }
  };

  if (!memberId || !contactId) {
    return (
      <div className="container mx-auto p-4">
        <p>Loading contact ID...</p>
      </div>
    );
  }

  if (isDetailsLoading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Edit Contact</h1>
        <p>Loading contact details...</p>
      </div>
    );
  }

  if (detailsError) {
    let errorMessage = "An unknown error occurred";

    if ("status" in detailsError) {
      const fetchError = detailsError as FetchBaseQueryError;
      if (typeof fetchError.data === "string") {
        errorMessage = fetchError.data;
      } else if (
        typeof fetchError.data === "object" &&
        fetchError.data !== null &&
        "message" in fetchError.data
      ) {
        errorMessage =
          (fetchError.data as { message?: string }).message || errorMessage;
      }
    } else if ("message" in detailsError) {
      errorMessage = (detailsError as SerializedError).message ?? errorMessage;
    }

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500">
          Error loading contact details: {errorMessage}
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!contactData) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Contact Not Found</h1>
        <p>The contact with ID {contactId} could not be found.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Edit Contact</h1>
        <Link href={`/contacts/${contactId}`}>
          <Button variant="outline">View Contact</Button>
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
                  <FormLabel>First Name</FormLabel>
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
                    {/* Ensure value is never null, convert null/undefined to "" */}
                    <Input
                      placeholder="Company Bank Account"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                    {/* Ensure value is never null, convert null/undefined to "" */}
                    <Input
                      placeholder="Vietcombank"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                    {/* Ensure value is never null, convert null/undefined to "" */}
                    <Input
                      placeholder="1234567890"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={isDetailsLoading || isUpdating}>
              {isUpdating ? "Updating Contact..." : "Update Contact"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default EditContactPage;
