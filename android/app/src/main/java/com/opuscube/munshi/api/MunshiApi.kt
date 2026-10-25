package com.opuscube.munshi.api

class ApiError(val status: Int, message: String) : Exception(message)

interface MunshiApi {
    suspend fun brief(): Brief
    suspend fun next(scope: String = "brief", interrupt: Boolean = false): Next
    suspend fun confirm(id: Long): ActionResult
    suspend fun decline(id: Long): ActionResult
    suspend fun converse(text: String): ActionResult
    suspend fun shelf(jpegBase64: String): ShelfResult
    suspend fun ledger(): Ledger
}
