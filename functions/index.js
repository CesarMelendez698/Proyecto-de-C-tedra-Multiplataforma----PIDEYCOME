const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

admin.initializeApp();

/**
 * Esta función se dispara cuando se elimina un documento en la ruta usuarios/{userId}
 * de Firestore. Al activarse, busca el UID y lo borra de Firebase Authentication.
 */
exports.eliminarUsuarioAuth = onDocumentDeleted("usuarios/{userId}", async (event) => {
  const userId = event.params.userId;

  try {
    await admin.auth().deleteUser(userId);
    logger.info(`Usuario con UID: ${userId} eliminado de Authentication exitosamente.`);
  } catch (error) {
    // Si el usuario no existe en Auth (pero sí en la DB), lanzamos un aviso
    if (error.code === 'auth/user-not-found') {
      logger.warn(`El usuario ${userId} ya no existía en Authentication.`);
    } else {
      logger.error(`Error eliminando al usuario ${userId}:`, error);
    }
  }
});