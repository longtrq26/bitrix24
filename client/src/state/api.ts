import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }),
  // 🚨 IMPORTANT: Add 'ContactDetails' to tagTypes
  tagTypes: ["Contacts", "ContactDetails"],
  endpoints: (builder) => ({
    getContacts: builder.query<
      any,
      { memberId: string; page?: number; limit?: number; search?: string }
    >({
      query: ({ memberId, page = 0, limit = 50, search }) => {
        const params = new URLSearchParams({
          memberId,
          page: page.toString(),
          limit: limit.toString(),
        });
        if (search) {
          params.append("search", search);
        }
        return `contacts?${params.toString()}`;
      },
      // You can also refine this to provide specific IDs if your list has them
      // For now, 'Contacts' for the list is fine if you always want to refetch the whole list.
      providesTags: ["Contacts"],
    }),

    getContactDetails: builder.query<
      any,
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => {
        const params = new URLSearchParams({ memberId });
        return `contacts/${contactId}?${params.toString()}`;
      },
      // 🚨 ADD THIS: providesTags for individual contact details
      providesTags: (result, error, { contactId }) => [
        { type: "ContactDetails", id: contactId },
      ],
    }),

    createContact: builder.mutation<any, { memberId: string; data: any }>({
      query: ({ memberId, data }) => ({
        url: `contacts?memberId=${memberId}`,
        method: "POST",
        body: data,
      }),
      // Invalidate both the list and potentially a general 'new contact' tag
      invalidatesTags: ["Contacts"],
    }),

    updateContact: builder.mutation<
      any,
      { memberId: string; contactId: string; data: any }
    >({
      query: ({ memberId, contactId, data }) => ({
        url: `contacts/${contactId}?memberId=${memberId}`,
        method: "PUT",
        body: data,
      }),
      // 🚨 IMPORTANT: Invalidate both the specific ContactDetails and the general Contacts list
      invalidatesTags: (result, error, { contactId }) => [
        { type: "ContactDetails", id: contactId }, // Invalidate the specific contact's details cache
        "Contacts", // Invalidate the general contacts list cache (if any list view might show updated data)
      ],
    }),

    deleteContact: builder.mutation<
      any,
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => ({
        url: `contacts/${contactId}?memberId=${memberId}`,
        method: "DELETE",
      }),
      // Invalidate both the list and the specific contact's details
      invalidatesTags: (result, error, { contactId }) => [
        "Contacts",
        { type: "ContactDetails", id: contactId },
      ],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactDetailsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
} = api;
