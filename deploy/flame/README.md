# Modelo FLAME horneado en la imagen

Coloca aquí `generic_model.pkl` para que quede **dentro** de la imagen de
despliegue. El entrypoint lo detecta solo.

Sirve para plataformas sin disco persistente y sin URL de descarga posible
(por ejemplo un Space privado de Hugging Face). Las otras dos formas de
proveer el modelo — montar un volumen o `FLAME_MODEL_URL` — siguen
funcionando igual; ver `docs/arquitecture/DEPLOY_FREE.md`.

El `.pkl` está en `.gitignore`: requiere registro en
<https://flame.is.tue.mpg.de> y su licencia no permite redistribuirlo, así
que no lo subas a un repositorio público.
