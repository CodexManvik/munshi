package com.opuscube.munshi.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opuscube.munshi.camera.jpegBase64
import com.opuscube.munshi.camera.newPhotoUri
import com.opuscube.munshi.conductor.Answer
import com.opuscube.munshi.conductor.Conductor
import com.opuscube.munshi.ui.components.HisaabSheet
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun MainScreen(conductor: Conductor, onRepair: () -> Unit) {
    val state by conductor.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    var showHisaab by remember { mutableStateOf(false) }
    var photoUri by remember { mutableStateOf<Uri?>(null) }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { conductor.shelf(jpegBase64(context, it)) }
    }
    val take = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val u = photoUri
        if (ok && u != null) conductor.shelf(jpegBase64(context, u))
        else pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }

    val today = remember { LocalDate.now().format(DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)) }
    MainContent(state, MainActions(
        openShop = { conductor.openShop() },
        yes = { haptic.performHapticFeedback(HapticFeedbackType.LongPress); conductor.answer(Answer.Yes) },
        no = { conductor.answer(Answer.No) },
        mic = { conductor.mic() },
        camera = { val u = newPhotoUri(context); photoUri = u; take.launch(u) },
        week = { showHisaab = true },
        repair = onRepair,
    ), today)

    val ledger = state.ledger
    if (showHisaab && ledger != null) HisaabSheet(ledger) { showHisaab = false }
}
