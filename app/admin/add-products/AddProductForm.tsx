"use client";

import { FieldValues, SubmitHandler, useForm } from "react-hook-form";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Input from "@/app/components/inputs/Input";
import Button from "@/app/components/Button";
import { categories } from "@/utils/Categories";
import CategoryInput from "@/app/components/inputs/CategoryInput";
import TextArea from "@/app/components/inputs/TextArea";
import SelectColor from "@/app/components/inputs/SelectColor";
import { colors } from "@/utils/Colors";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import firebaseApp from "@/libs/firebase";
import Heading from "@/app/components/Heading";
import CustomCheckBox from "@/app/components/inputs/CustomCheckBox";

export type ImageType = {
  color: string;
  colorCode: string;
  image: File | null;
};

export type UploadedImageType = {
  color: string;
  colorCode: string;
  image: string;
};

const AddProductForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<ImageType[] | null>();
  const [isProductCreated, setIsProductCreated] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      name: "",
      description: "",
      price: "",
      brand: "",
      category: "",
      inStock: false,
      images: [],
    },
  });

  useEffect(() => {
    setCustomValue("images", images);
  }, [images]);

  useEffect(() => {
    if (isProductCreated) {
      reset();
      setImages(null);
      setIsProductCreated(false);
    }
  }, [isProductCreated]);

  const setCustomValue = (id: string, value: any) => {
    setValue(id, value, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const category = watch("category");

  const onSubmit: SubmitHandler<FieldValues> = async (data) => {
    setIsLoading(true);
    let uploadedImages: UploadedImageType[] = [];

    if (!data.category) {
      setIsLoading(false);
      return toast.error("Category is not selected");
    }

    if (!data.images || data.images.length === 0) {
      setIsLoading(false);
      return toast.error("Select at least one color and image");
    }

    const handleImageUploads = async () => {
      toast("Creating product. This might take a while...", {
        icon: "🔃",
      });
      try {
        for (const item of data.images) {
          if (item.image) {
            const fileName = new Date().getTime() + "-" + item.image.name;
            const storage = getStorage(firebaseApp);
            const storageRef = ref(storage, `products/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, item.image);

            await new Promise<void>((resolve, reject) => {
              uploadTask.on(
                "state_changed",
                (snapshot) => {
                  const progress =
                    (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  console.log("Upload is " + progress + "% done");
                  switch (snapshot.state) {
                    case "paused":
                      break;
                    case "running":
                      break;
                  }
                },
                (error) => {
                  console.log("Error uploading image", error);
                  reject(error);
                },
                () => {
                  getDownloadURL(uploadTask.snapshot.ref)
                    .then((downloadURL) => {
                      uploadedImages.push({
                        ...item,
                        image: downloadURL,
                      });

                      console.log("File available at", downloadURL);
                      resolve();
                    })
                    .catch((error) => {
                      console.log("Error getting download URL", error);
                      reject(error);
                    });
                }
              );
            });
          }
        }
      } catch (error) {
        setIsLoading(false);
        console.log("Error handling image uploads", error);
        return toast.error("An error occurred while handling image uploads");
      }
    };

    await handleImageUploads();
    const productData = { ...data, images: uploadedImages };

    axios
      .post("/api/product", productData)
      .then(() => {
        toast.success("Product created");
        setIsProductCreated(true);
        router.refresh();
      })
      .catch((error) => {
        toast.error("Something went wrong when creating a product");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const addImageToState = useCallback((value: ImageType) => {
    setImages((prev) => {
      if (!prev) {
        return [value];
      }
      return [...prev, value];
    });
  }, []);

  const removeImageFromState = useCallback((value: ImageType) => {
    setImages((prev) => {
      if (prev) {
        const filteredImages = prev.filter(
          (item) => item.color !== value.color
        );
        return filteredImages;
      }
      return prev;
    });
  }, []);

  return (
    <>
      <Heading title="Agregar Producto" center />
      <Input
        id="name"
        label="Nombre"
        disabled={isLoading}
        register={register}
        errors={errors}
        required
      ></Input>
      <Input
        id="price"
        label="Precio"
        disabled={isLoading}
        register={register}
        errors={errors}
        type="number"
        required
      ></Input>
      <Input
        id="brand"
        label="Marca"
        disabled={isLoading}
        register={register}
        errors={errors}
        required
      ></Input>
      <TextArea
        id="description"
        label="Descripción"
        disabled={isLoading}
        register={register}
        errors={errors}
        required
      />
      <CustomCheckBox
        id="inStock"
        register={register}
        label="Producto en Stock"
      />
      <div className="w-full font-medium">
        <div className="mb-2 font-semibold">Seleccionar una Categoria</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
          {categories.map((item) => {
            if (item.label === "All") {
              return null;
            }

            return (
              <div key={item.label} className="col-span">
                <CategoryInput
                  onClick={(category) => setCustomValue("category", category)}
                  selected={category === item.label}
                  label={item.label}
                  icon={item.icon}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="w-full flex flex-col flex-wrap gap-4">
        <div>
          <div className="font-semibold">
            Elige los colores disponibles del producto y sube sus imágenes
            correspondientes.
          </div>
          <ul className="text-sm">
            Debes subir una imagen para cada uno de los colores seleccionados,
            de lo contrario, tu elección de color será ignorada.
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {colors.map((item, index) => {
            return (
              <SelectColor
                key={index}
                item={item}
                addImageToState={addImageToState}
                removeImageFromState={removeImageFromState}
                isProductCreated={isProductCreated}
              />
            );
          })}
        </div>
      </div>
      <Button
        label={isLoading ? "Cargando..." : "Agregar Producto"}
        onClick={handleSubmit(onSubmit)}
      />
    </>
  );
};

export default AddProductForm;
