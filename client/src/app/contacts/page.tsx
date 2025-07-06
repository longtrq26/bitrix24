"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_MEMBER_ID } from "@/lib/constants";
import { useGetContactsQuery } from "@/state/api";
import { Contact } from "@/types";
import { FetchBaseQueryError } from "@reduxjs/toolkit/query/react";
import { Eye, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import React, { ChangeEvent, useState } from "react";

const ContactsPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [limit] = useState(10);

  // Lấy danh sách contact
  const { data, error, isLoading, isFetching, refetch } = useGetContactsQuery({
    memberId: DEFAULT_MEMBER_ID,
    page,
    limit,
    search: searchQuery,
  });

  // Xử lý tìm kiếm
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  // Xử lý phân trang
  const totalContacts = data?.total || 0;
  const pagination = {
    page,
    totalPages: Math.ceil(totalContacts / limit),
    canPrev: page > 0,
    canNext: (page + 1) * limit < totalContacts,
  };

  const handleNextPage = () => {
    if (pagination.canNext) setPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (pagination.canPrev) setPage((prev) => prev - 1);
  };

  // Loading
  if (isLoading && !isFetching) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6 text-center">Contacts</h1>
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-[300px] w-full rounded-md" />
      </div>
    );
  }

  // Error
  if (error) {
    let errorMessage = "An unknown error occurred";

    if ("status" in error) {
      const fetchError = error as FetchBaseQueryError;
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
    } else if ("message" in error) {
      errorMessage = error.message as string;
    }

    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Contacts</h1>
        <p className="text-red-500 mb-2">
          Failed to load contacts: {errorMessage}
        </p>
        <Button onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const contacts = data?.data || [];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Bitrix24 Contacts</h1>

      <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
        <Input
          type="text"
          placeholder="Search contacts by name..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="max-w-md"
        />
        <Link href="/contacts/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Contact
          </Button>
        </Link>
      </div>

      {isFetching && !isLoading && (
        <p className="text-sm text-gray-500 mb-2">Refreshing contacts...</p>
      )}

      {contacts.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          No contacts found. Try adjusting your search or add a new contact.
        </div>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact: Contact) => (
                <TableRow key={contact.ID}>
                  <TableCell className="font-medium">
                    {contact.NAME} {contact.LAST_NAME}
                  </TableCell>
                  <TableCell>{contact.EMAIL?.[0]?.VALUE || "—"}</TableCell>
                  <TableCell>{contact.PHONE?.[0]?.VALUE || "—"}</TableCell>
                  <TableCell>{contact.ADDRESS_CITY || "—"}</TableCell>
                  <TableCell className="text-right space-x-2 flex justify-end">
                    <Link href={`/contacts/${contact.ID}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Link href={`/contacts/edit/${contact.ID}`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6">
        <Button
          onClick={handlePrevPage}
          disabled={!pagination.canPrev || isLoading || isFetching}
          variant="outline"
        >
          Previous
        </Button>
        <span className="text-sm text-gray-600">
          Page {pagination.page + 1} of {pagination.totalPages} —{" "}
          {totalContacts} contacts
        </span>
        <Button
          onClick={handleNextPage}
          disabled={!pagination.canNext || isLoading || isFetching}
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default ContactsPage;
