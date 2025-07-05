import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }),
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
    }),

    getContactDetails: builder.query<
      any,
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => {
        const params = new URLSearchParams({ memberId });
        return `contacts/${contactId}?${params.toString()}`;
      },
    }),
    createContact: builder.mutation<any, { memberId: string; data: any }>({
      query: ({ memberId, data }) => ({
        url: `contacts?memberId=${memberId}`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["Contacts"], // Invalidate contacts list on creation
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
      invalidatesTags: ["Contacts"], // Invalidate contacts list on update
    }),
    deleteContact: builder.mutation<
      any,
      { memberId: string; contactId: string }
    >({
      query: ({ memberId, contactId }) => ({
        url: `contacts/${contactId}?memberId=${memberId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Contacts"], // Invalidate contacts list on deletion
    }),
  }),
  tagTypes: ["Contacts"],
});

export const {
  useGetContactsQuery,
  useGetContactDetailsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
} = api;
